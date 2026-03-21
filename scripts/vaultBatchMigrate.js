/**
 * vaultBatchMigrate.js
 *
 * Migrates active deposits from a legacy TokenVaultUpgradeable to the new one.
 *
 * Usage:
 *   LEGACY_VAULT_ADDRESS=0x...  npx hardhat run scripts/vaultBatchMigrate.js --network <network>
 *
 * Environment variables (on top of the regular hardhat .env):
 *   LEGACY_VAULT_ADDRESS        – proxy address of the OLD vault (required)
 *   LEGACY_VAULT_DEPLOY_BLOCK   – block the legacy vault was deployed at; scan
 *                                  starts here instead of block 0 (optional, default 0)
 *   LEGACY_VAULT_END_BLOCK      – last block to scan (inclusive); useful when the old
 *                                  vault was paused/deprecated at a known block so you
 *                                  don't scan all the way to chain tip (optional, default: latest)
 *   MIGRATION_DRY_RUN           – set to "true" to simulate without sending txs (optional)
 *
 * The script:
 *   1. Fetches VaultDepositEvents from the legacy vault to enumerate all depositors.
 *   2. For each depositor, calls getUserActiveDeposits() and getDeposit() to read
 *      the full LockedDeposit struct.
 *   3. Skips deposits that are already marked as withdrawn or have already been
 *      migrated on the new vault (idempotent).
 *   4. Chunks the remaining deposits into batches of MIGRATION_SIZE (≤ 150) and
 *      calls newVault.batchMigrateDeposits().
 */

const { ethers } = require("hardhat");
const { getDeploymentAddress } = require("../launch/DeploymentStore");
const { PROTOCOL, VAULT_V2_SUPPORTED_TOKENS } = require("../launch/config");

const axios = require("axios");


// ---------------------------------------------------------------------------
//  ABI fragments – only what we need from each contract
// ---------------------------------------------------------------------------

const LEGACY_VAULT_ABI = [
  "event VaultDeposit(uint256 indexed depositId, address indexed user, address indexed token, uint256 yieldId, uint256 amount, uint256 entryFee, uint256 unlockTimestamp, uint256 depositPrice)",
  "function getUserActiveDeposits(address user) external view returns (uint256[])",
  "function getDeposit(uint256 depositId) external view returns (tuple(uint256 depositId, address user, address token, uint256 yieldId, uint256 principal, uint256 aprBps, uint256 depositTimestamp, uint256 unlockTimestamp, bool withdrawn, uint256 dailyWinning, uint256 depositPrice, uint256 withdrawPrice))",
];

const NEW_VAULT_ABI = [
  "function batchMigrateDeposits(uint256[] calldata legacyDepositIds, address[] calldata users, address[] calldata tokens, uint256[] calldata yieldIds, uint256[] calldata netPrincipals, uint256[] calldata depositTimestamps, uint256[] calldata unlockTimestamps, uint256[] calldata aprBpsList) external",
  "function isLegacyDepositMigrated(uint256 legacyDepositId) external view returns (bool)",
  "function isSupportedToken(address token) external view returns (bool)",
];

// ---------------------------------------------------------------------------
//  Helpers
// ---------------------------------------------------------------------------

/**
 * Chunk an array into sub-arrays of at most `size` elements.
 */
function chunk(array, size) {
  const chunks = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

// Max blocks per eth_getLogs request — stays well under QuickNode/Alchemy payload limits.
const LOG_PAGE_SIZE = 2_000;

/**
 * Collect unique depositor addresses from VaultDeposit events.
 * Paginates through blocks in windows of LOG_PAGE_SIZE to avoid hitting
 * the RPC provider's payload size limit (HTTP 413).
 *
 * @param {ethers.Contract} legacyVault
 * @param {number}          fromBlock – first block to scan (inclusive)
 */
async function collectDepositors(legacyVault, fromBlock, endBlock) {
  console.log(
    "\n🔍 Scanning legacy vault for depositors via VaultDeposit events...",
  );

  //   const latestBlock = await ethers.provider.getBlockNumber();
  const filter = legacyVault.filters.VaultDeposit();

  const depositors = new Set();
  let totalEvents = 0;
  let currentFrom = fromBlock;

  while (currentFrom <= endBlock) {
    const currentTo = Math.min(currentFrom + LOG_PAGE_SIZE - 1, endBlock);

    let events = [];
    try {
      events = await legacyVault.queryFilter(filter, currentFrom, currentTo);
    } catch (err) {
      // If the window is still too large, halve it and retry once.
      const halfWindow = Math.floor((currentTo - currentFrom) / 2);
      if (halfWindow < 1) throw err; // cannot shrink further

      console.warn(
        `\n   ⚠️  RPC error on blocks ${currentFrom}–${currentTo}, ` +
        `retrying with smaller window (${halfWindow} blocks)... [${err.message}]`,
      );
      events = await legacyVault.queryFilter(
        filter,
        currentFrom,
        currentFrom + halfWindow,
      );
      currentFrom = currentFrom + halfWindow + 1;
      for (const ev of events) depositors.add(ev.args.user);
      totalEvents += events.length;
      continue;
    }

    for (const ev of events) depositors.add(ev.args.user);
    totalEvents += events.length;
    currentFrom = currentTo + 1;

    process.stdout.write(
      `\r   Scanned up to block ${currentTo.toLocaleString()} / ${endBlock.toLocaleString()} ` +
      `— ${depositors.size} depositor(s), ${totalEvents} event(s) found   `,
    );
  }

  console.log(
    `\n   Done. Found ${depositors.size} unique depositor(s) across ${totalEvents} event(s).`,
  );
  return [...depositors];
}

// ---------------------------------------------------------------------------
//  Main
// ---------------------------------------------------------------------------

async function main() {
  const MIGRATION_BATCH_SIZE = PROTOCOL.MIGRATION_SIZE ?? 150;
  const DRY_RUN = process.env.MIGRATION_DRY_RUN === "true";

  // -- Signers & addresses -------------------------------------------------
  const [, adminWallet] = await ethers.getSigners();
  console.log(`\n🚀 Vault Migration Script`);
  console.log(`   Admin wallet  : ${adminWallet.address}`);
  console.log(`   Batch size    : ${MIGRATION_BATCH_SIZE}`);
  console.log(`   Dry run       : ${DRY_RUN}`);

  const legacyVaultAddress = process.env.LEGACY_VAULT_ADDRESS;
  if (!legacyVaultAddress || !ethers.isAddress(legacyVaultAddress)) {
    throw new Error(
      "❌ LEGACY_VAULT_ADDRESS env var is missing or invalid. " +
      "Set it to the proxy address of the old vault.",
    );
  }

  // Start/end block for the event scan.
  // LEGACY_VAULT_DEPLOY_BLOCK  – avoids scanning from block 0.
  // LEGACY_VAULT_END_BLOCK     – avoids scanning past the point where the old vault was deprecated.
  const fromBlock = process.env.LEGACY_VAULT_DEPLOY_BLOCK
    ? parseInt(process.env.LEGACY_VAULT_DEPLOY_BLOCK, 10)
    : 0;
  const endBlock = process.env.LEGACY_VAULT_END_BLOCK
    ? parseInt(process.env.LEGACY_VAULT_END_BLOCK, 10)
    : null;

  const newVaultAddress = await getDeploymentAddress("TokenVaultUpgradeable");

  const networkInfo = await ethers.provider.getNetwork();
  const chainId = Number(networkInfo.chainId);

  console.log(`   Legacy vault  : ${legacyVaultAddress}`);
  console.log(`   New vault     : ${newVaultAddress}`);
  console.log(`   Scan from blk : ${fromBlock.toLocaleString()}`);
  console.log(
    `   Scan to blk   : ${endBlock !== null ? endBlock.toLocaleString() : "latest (chain tip)"
    }`,
  );

  if (legacyVaultAddress.toLowerCase() === newVaultAddress.toLowerCase()) {
    throw new Error(
      "❌ LEGACY_VAULT_ADDRESS and new vault address are the same!",
    );
  }

  // -- Contract instances --------------------------------------------------
  // By bypassing the local Hardhat Node for reads and going straight to the real
  // chain RPC, we avoid the "No known hardfork for execution on historical block"
  // Hardhat fork bug — and ensure eth_getLogs targets the CORRECT chain.
  //
  // Chain-aware RPC selection (matches chainId reported by the forked network):
  //   42161 → ARBITRUM_MAINNET_RPC_URL
  //   8453  → BASE_MAINNET_RPC_URL
  //   1     → MAINNET_RPC_URL
  //   137   → POLYGON_MAINNET_RPC_URL
  //   (any other) → fall back to ethers.provider (the local Hardhat node)
  require("dotenv").config();

  const CHAIN_RPC_MAP = {
    42161: process.env.ARBITRUM_MAINNET_RPC_URL, // Arbitrum One
    8453: process.env.BASE_MAINNET_RPC_URL, // Base
    1: process.env.MAINNET_RPC_URL, // Ethereum mainnet
    137: process.env.POLYGON_MAINNET_RPC_URL, // Polygon
  };

  const readRpcUrl = CHAIN_RPC_MAP[chainId];
  if (!readRpcUrl) {
    console.warn(
      `   ⚠️  No RPC URL found in env for chainId=${chainId}. ` +
      `Falling back to local Hardhat provider — eth_getLogs may fail on historical blocks.`,
    );
  } else {
    console.log(
      `   Read RPC      : ${readRpcUrl.slice(0, 40)}… (chainId=${chainId})`,
    );
  }

  const readProvider = readRpcUrl
    ? new ethers.JsonRpcProvider(readRpcUrl)
    : ethers.provider;

  const legacyVault = new ethers.Contract(
    legacyVaultAddress,
    LEGACY_VAULT_ABI,
    readProvider,
  );

  const newVault = await ethers.getContractAt(
    NEW_VAULT_ABI,
    newVaultAddress,
    readProvider,
  );

  const newVaultWrite = new ethers.Contract(
    newVaultAddress,
    NEW_VAULT_ABI,
    adminWallet, // 👈 for txs only
  );

  // -- Step 1: Collect all depositors from events --------------------------
  const depositors = await collectDepositors(legacyVault, fromBlock, endBlock);
  console.log(
    "### ~ vaultBatchMigrate.js:192 ~ main ~ depositors:",
    depositors,
  );

  // -- Step 2: Enumerate all active deposits across depositors -------------
  console.log("\n📋 Reading active deposits from legacy vault...");

  /** @type {{ legacyDepositId: bigint, user: string, token: string, yieldId: bigint, netPrincipal: bigint, depositTimestamp: bigint, unlockTimestamp: bigint, aprBps: bigint }[]} */
  const toMigrate = [];
  let skippedWithdrawn = 0;
  let skippedAlready = 0;
  let skippedUnsupported = 0;

  for (const user of depositors) {
    console.log("### ~ vaultBatchMigrate.js:204 ~ main ~ user:", user);
    let activeIds;
    try {
      activeIds = await legacyVault.getUserActiveDeposits(user);
      console.log(
        "### ~ vaultBatchMigrate.js:227 ~ main ~ activeIds:",
        activeIds,
      );
    } catch (err) {
      console.warn(
        `   ⚠️  Could not fetch deposits for ${user}: ${err.message}`,
      );
      continue;
    }

    for (const legacyDepositId of activeIds) {
      let dep;
      try {
        dep = await legacyVault.getDeposit(legacyDepositId);
        console.log("### ~ vaultBatchMigrate.js:239 ~ main ~ dep:", dep);
      } catch (err) {
        console.warn(
          `   ⚠️  Could not read deposit #${legacyDepositId}: ${err.message}`,
        );
        continue;
      }

      // Skip already withdrawn on legacy side
      if (dep.withdrawn) {
        skippedWithdrawn++;
        continue;
      }

      // Skip if token not supported on new vault
      let supported;
      try {
        supported = await newVault.isSupportedToken(dep.token);
        console.log(
          "### ~ vaultBatchMigrate.js:261 ~ main ~ supported:",
          supported,
        );
      } catch (err) {
        supported = false;
      }
      if (!supported) {
        console.warn(
          `   ⚠️  Token ${dep.token} not supported on new vault — skipping deposit #${legacyDepositId}`,
        );
        skippedUnsupported++;
        continue;
      }

      // Skip if already migrated (idempotent guard on new vault)
      let alreadyMigrated;
      try {
        alreadyMigrated = await newVault.isLegacyDepositMigrated(
          legacyDepositId,
        );
      } catch {
        alreadyMigrated = false;
      }
      if (alreadyMigrated) {
        skippedAlready++;
        continue;
      }

      toMigrate.push({
        legacyDepositId,
        user: dep.user,
        token: dep.token,
        yieldId: dep.yieldId,
        // The old vault's field is `principal` (already net of entry fee)
        netPrincipal: dep.principal,
        depositTimestamp: dep.depositTimestamp,
        unlockTimestamp: dep.unlockTimestamp,
        aprBps: dep.aprBps,
      });
    }
  }

  console.log(`\n📊 Migration summary:`);
  console.log(`   To migrate          : ${toMigrate.length}`);
  console.log(`   Skipped (withdrawn) : ${skippedWithdrawn}`);
  console.log(`   Skipped (already)   : ${skippedAlready}`);
  console.log(`   Skipped (unsupported token): ${skippedUnsupported}`);

  if (toMigrate.length === 0) {
    console.log("\n✅ Nothing to migrate. Exiting.");
    return;
  }

  if (DRY_RUN) {
    console.log("\n🔶 DRY RUN — no transactions will be sent.");
    console.log("   Deposits that would be migrated:");
    for (const d of toMigrate) {
      console.log(
        `   #${d.legacyDepositId} | user=${d.user} | token=${d.token} | ` +
        `principal=${ethers.formatUnits(d.netPrincipal, 18)} | ` +
        `unlock=${new Date(Number(d.unlockTimestamp) * 1000).toISOString()}`,
      );
    }
    return;
  }

  // -- Step 3: Batch-migrate -----------------------------------------------
  console.log(
    `\n⛓️  Sending migration transactions in batches of ${MIGRATION_BATCH_SIZE}...`,
  );

  const batches = chunk(toMigrate, MIGRATION_BATCH_SIZE);
  let totalMigrated = 0;

  for (let batchIdx = 0; batchIdx < batches.length; batchIdx++) {
    const batch = batches[batchIdx];
    console.log(
      `\n   Batch ${batchIdx + 1}/${batches.length} (${batch.length
      } deposits)...`,
    );

    const legacyDepositIds = batch.map((d) => d.legacyDepositId);
    const users = batch.map((d) => d.user);
    const tokens = batch.map((d) => d.token);
    const yieldIds = batch.map((d) => d.yieldId);
    const netPrincipals = batch.map((d) => d.netPrincipal);
    const depositTimestamps = batch.map((d) => d.depositTimestamp);
    const unlockTimestamps = batch.map((d) => d.unlockTimestamp);
    const aprBpsList = batch.map((d) => d.aprBps);

    try {
      const tx = await newVaultWrite.batchMigrateDeposits(
        legacyDepositIds,
        users,
        tokens,
        yieldIds,
        netPrincipals,
        depositTimestamps,
        unlockTimestamps,
        aprBpsList,
      );

      console.log(`   📤 Tx submitted: ${tx.hash}`);
      const receipt = await tx.wait();
      console.log(
        `   ✅ Confirmed in block ${receipt.blockNumber
        } (gas used: ${receipt.gasUsed.toString()})`,
      );

      totalMigrated += batch.length;
    } catch (err) {
      console.error(`   ❌ Batch ${batchIdx + 1} failed: ${err.message}`);
      // Continue with remaining batches rather than aborting everything
    }
  }

  console.log(
    `\n🎉 Migration complete. ${totalMigrated}/${toMigrate.length} deposits migrated successfully.`,
  );
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n💥 Vault migration failed:", error);
    process.exit(1);
  });
