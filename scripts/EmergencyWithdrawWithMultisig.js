var hre = require("hardhat");
const fs = require("fs");
const path = require("path");

var { default: SafeApi } = require("@safe-global/api-kit")
var safe = require("@safe-global/protocol-kit")
var { OperationType, MetaTransactionData } = require("@safe-global/types-kit");
const { default: Safe, EthSafeSignature } = require("@safe-global/protocol-kit");
const CONFIG = require("../launch/config");
const { getDeploymentAddress } = require("../launch/DeploymentStore");

const getSafeAddress = async () => {
  const network = await hre.ethers.provider.getNetwork();
  const chainId = Number(network.chainId);
  return CONFIG.ADDRESSES_PER_CHAIN[chainId]?.SAFE_ADDRESS;
};

async function encodeEmergencyWithdraw() {
  


  const contractName = process.env.CONTRACT;
  console.log(contractName)
  const contractAddress = await getDeploymentAddress(contractName);
  
  const contract = await hre.ethers.getContractAt(contractName, contractAddress);

  const tokens = [
    process.env.MAIN_TOKEN_ADDRESS,
  ];

  const to = process.env.MASTER_ADMIN_WALLET;

  console.log("Tokens: ", tokens, contractName, contractAddress);
  console.log("To: ", to);
  const calldata = contract.interface.encodeFunctionData(
    "emergencyERC20BatchWithdrawal",
    [tokens, to]
  );

  const dataToSave = { calldata };
  fs.writeFileSync(
    path.join(__dirname, `../EmergencyWithdraw-rawData.json`),
    JSON.stringify(dataToSave, null, 2)
  );

  console.log("✅ Encoded calldata saved.");
}

async function encodeSetMaxWithdrawalSize() {

 console.log("Provider: ", provider);
 console.log("Wallet: ");
  const contractName = "VaultManagerUpgradeable";
  const contractAddress = await getDeploymentAddress(contractName);
  const contract = await hre.ethers.getContractAt(contractName, contractAddress);

  const maxWithdrawalSize = process.env.MAX_WITHDRAWAL_SIZE || "150";

  console.log("Max Withdrawal Size:", maxWithdrawalSize);
  const calldata = contract.interface.encodeFunctionData(
    "setMaxWithdrawalSize",
    [maxWithdrawalSize]
  );

  const dataToSave = { calldata };
  fs.writeFileSync(
    path.join(__dirname, `../SetMaxWithdrawalSize-rawData.json`),
    JSON.stringify(dataToSave, null, 2)
  );

  console.log("✅ Encoded calldata saved.");
}

async function encodeSetProtocolConfig() {
  const contractName = process.env.CONTRACT; // Can be VaultManagerUpgradeable, AggregatorUpgradeable, LiquidityManagerUpgradeable, OracleSwapUpgradeable, LiquidityHelperUpgradeable
  const contractAddress = await getDeploymentAddress(contractName);
  const contract = await hre.ethers.getContractAt(contractName, contractAddress);

  const newProtocolConfigAddress = process.env.NEW_PROTOCOL_CONFIG_ADDRESS;

  console.log("Contract:", contractName);
  console.log("New Protocol Config Address:", newProtocolConfigAddress);
  const calldata = contract.interface.encodeFunctionData(
    "setProtocolConfigAddress",
    [newProtocolConfigAddress]
  );

  const dataToSave = { calldata };
  fs.writeFileSync(
    path.join(__dirname, `../SetProtocolConfig-rawData.json`),
    JSON.stringify(dataToSave, null, 2)
  );

  console.log("✅ Encoded calldata saved.");
}

async function encodeWithdrawCompanyFees() {


  const contractName = "VaultManagerUpgradeable";
  const contractAddress = await getDeploymentAddress(contractName);
  const contract = await hre.ethers.getContractAt(contractName, contractAddress);

  const to = process.env.MASTER_ADMIN_WALLET;

  console.log("To:", to);
  const calldata = contract.interface.encodeFunctionData(
    "withdrawCompanyFees",
    [to]
  );

  const dataToSave = { calldata };
  fs.writeFileSync(
    path.join(__dirname, `../WithdrawCompanyFees-rawData.json`),
    JSON.stringify(dataToSave, null, 2)
  );

  console.log("✅ Encoded calldata saved.");
}

async function encodeEmergencyNFTWithdraw() {


  const contractName = "VaultManagerUpgradeable";
  const contractAddress = await getDeploymentAddress(contractName);
  const contract = await hre.ethers.getContractAt(contractName, contractAddress);

  const nftContract = process.env.NFT_CONTRACT_ADDRESS;
  const tokenIds = process.env.TOKEN_IDS ? process.env.TOKEN_IDS.split(',').map(id => id.trim()) : [];
  const to = process.env.MASTER_ADMIN_WALLET;

  console.log("NFT Contract:", nftContract);
  console.log("Token IDs:", tokenIds);
  console.log("To:", to);

  const calldata = contract.interface.encodeFunctionData(
    "emergencyERC721BatchWithdrawal",
    [nftContract, tokenIds, to]
  );

  const dataToSave = { calldata };
  fs.writeFileSync(
    path.join(__dirname, `../EmergencyNFTWithdraw-rawData.json`),
    JSON.stringify(dataToSave, null, 2)
  );

  console.log("✅ Encoded calldata saved.");
}

async function encodeSetMaxMigrationSize() {


  const contractName = "AggregatorUpgradeable";
  const contractAddress = await getDeploymentAddress(contractName);
  const contract = await hre.ethers.getContractAt(contractName, contractAddress);

  const maxMigrationSize = process.env.MAX_MIGRATION_SIZE || "150";

  console.log("Max Migration Size:", maxMigrationSize);
  const calldata = contract.interface.encodeFunctionData(
    "setMaxMigrationSize",
    [maxMigrationSize]
  );

  const dataToSave = { calldata };
  fs.writeFileSync(
    path.join(__dirname, `../SetMaxMigrationSize-rawData.json`),
    JSON.stringify(dataToSave, null, 2)
  );

  console.log("✅ Encoded calldata saved.");
}

async function encodeSetUserManagerAddress() {


  const contractName = process.env.CONTRACT;
  const contractAddress = await getDeploymentAddress(contractName);
  const contract = await hre.ethers.getContractAt(contractName, contractAddress);

  const newUserManagerAddress = process.env.NEW_USER_MANAGER_ADDRESS;

  console.log("Contract:", contractName);
  console.log("New User Manager Address:", newUserManagerAddress);
  const calldata = contract.interface.encodeFunctionData(
    "setUserManagerAddress",
    [newUserManagerAddress]
  );

  const dataToSave = { calldata };
  fs.writeFileSync(
    path.join(__dirname, `../SetUserManagerAddress-rawData.json`),
    JSON.stringify(dataToSave, null, 2)
  );

  console.log("✅ Encoded calldata saved.");
}

async function encodeSetTokenOracles() {


  const contractName = "OracleSwapUpgradeable";
  const contractAddress = await getDeploymentAddress(contractName);
  const contract = await hre.ethers.getContractAt(contractName, contractAddress);

  const tokens = process.env.TOKEN_ORACLES_TOKENS ? process.env.TOKEN_ORACLES_TOKENS.split(',').map(t => t.trim()) : [];
  const oracles = process.env.TOKEN_ORACLES_ORACLES ? process.env.TOKEN_ORACLES_ORACLES.split(',').map(o => o.trim()) : [];

  console.log("Tokens:", tokens);
  console.log("Oracles:", oracles);
  const calldata = contract.interface.encodeFunctionData(
    "setTokenOracles",
    [tokens, oracles]
  );

  const dataToSave = { calldata };
  fs.writeFileSync(
    path.join(__dirname, `../SetTokenOracles-rawData.json`),
    JSON.stringify(dataToSave, null, 2)
  );

  console.log("✅ Encoded calldata saved.");
}

async function encodeSetTWAPWindow() {


  const contractName = "OracleSwapUpgradeable";
  const contractAddress = await getDeploymentAddress(contractName);
  const contract = await hre.ethers.getContractAt(contractName, contractAddress);

  const window = process.env.TWAP_WINDOW;

  console.log("TWAP Window:", window);
  const calldata = contract.interface.encodeFunctionData(
    "setTWAPWindow",
    [window]
  );

  const dataToSave = { calldata };
  fs.writeFileSync(
    path.join(__dirname, `../SetTWAPWindow-rawData.json`),
    JSON.stringify(dataToSave, null, 2)
  );

  console.log("✅ Encoded calldata saved.");
}

async function encodeSetSlippageParameters() {


  const contractName = "OracleSwapUpgradeable";
  const contractAddress = await getDeploymentAddress(contractName);
  const contract = await hre.ethers.getContractAt(contractName, contractAddress);

  const numerator = process.env.SLIPPAGE_NUMERATOR;

  console.log("Slippage Numerator:", numerator);
  const calldata = contract.interface.encodeFunctionData(
    "setSlippageParameters",
    [numerator]
  );

  const dataToSave = { calldata };
  fs.writeFileSync(
    path.join(__dirname, `../SetSlippageParameters-rawData.json`),
    JSON.stringify(dataToSave, null, 2)
  );

  console.log("✅ Encoded calldata saved.");
}

async function encodeSetAddress() {


  const contractName = "ProtocolConfigUpgradeable";
  const contractAddress = await getDeploymentAddress(contractName);
  const contract = await hre.ethers.getContractAt(contractName, contractAddress);

  const key = process.env.CONFIG_KEY;
  const val = process.env.CONFIG_VALUE_ADDRESS;

  console.log("Key:", key);
  console.log("Value:", val);
  const calldata = contract.interface.encodeFunctionData(
    "setAddress",
    [key, val]
  );

  const dataToSave = { calldata };
  fs.writeFileSync(
    path.join(__dirname, `../SetAddress-rawData.json`),
    JSON.stringify(dataToSave, null, 2)
  );

  console.log("✅ Encoded calldata saved.");
}

async function encodeSetUint() {


  const contractName = "ProtocolConfigUpgradeable";
  const contractAddress = await getDeploymentAddress(contractName);
  const contract = await hre.ethers.getContractAt(contractName, contractAddress);

  const key = process.env.CONFIG_KEY;
  const val = process.env.CONFIG_VALUE_UINT;

  console.log("Key:", key);
  console.log("Value:", val);
  const calldata = contract.interface.encodeFunctionData(
    "setUint",
    [key, val]
  );

  const dataToSave = { calldata };
  fs.writeFileSync(
    path.join(__dirname, `../SetUint-rawData.json`),
    JSON.stringify(dataToSave, null, 2)
  );

  console.log("✅ Encoded calldata saved.");
}

async function encodeSetUserPackage() {


  const contractName = "VaultManagerUpgradeable";
  const contractAddress = await getDeploymentAddress(contractName);
  const contract = await hre.ethers.getContractAt(contractName, contractAddress);

  const user = process.env.USER_PACKAGE_USER;
  const packageId = process.env.USER_PACKAGE_ID;

  console.log("User:", user);
  console.log("Package ID:", packageId);
  const calldata = contract.interface.encodeFunctionData(
    "setUserPackage",
    [user, packageId]
  );

  const dataToSave = { calldata };
  fs.writeFileSync(
    path.join(__dirname, `../SetUserPackage-rawData.json`),
    JSON.stringify(dataToSave, null, 2)
  );

  console.log("✅ Encoded calldata saved.");
}

async function encodeSetPackageCap() {


  const contractName = "VaultManagerUpgradeable";
  const contractAddress = await getDeploymentAddress(contractName);
  const contract = await hre.ethers.getContractAt(contractName, contractAddress);

  const liquidityCap = process.env.PACKAGE_CAP_LIQUIDITY;
  const feeCap = process.env.PACKAGE_CAP_FEE;
  const userFeePct = process.env.PACKAGE_CAP_USER_FEE;

  console.log("Liquidity Cap:", liquidityCap);
  console.log("Fee Cap:", feeCap);
  console.log("User Fee Pct:", userFeePct);
  const calldata = contract.interface.encodeFunctionData(
    "setPackageCap",
    [liquidityCap, feeCap, userFeePct]
  );

  const dataToSave = { calldata };
  fs.writeFileSync(
    path.join(__dirname, `../SetPackageCap-rawData.json`),
    JSON.stringify(dataToSave, null, 2)
  );

  console.log("✅ Encoded calldata saved.");
}

async function encodeUpdatePackageCap() {


  const contractName = "VaultManagerUpgradeable";
  const contractAddress = await getDeploymentAddress(contractName);
  const contract = await hre.ethers.getContractAt(contractName, contractAddress);

  const packageId = process.env.PACKAGE_CAP_ID;
  const liquidityCap = process.env.PACKAGE_CAP_LIQUIDITY;
  const feeCap = process.env.PACKAGE_CAP_FEE;
  const userFeePct = process.env.PACKAGE_CAP_USER_FEE;

  console.log("Package ID:", packageId);
  console.log("Liquidity Cap:", liquidityCap);
  console.log("Fee Cap:", feeCap);
  console.log("User Fee Pct:", userFeePct);
  const calldata = contract.interface.encodeFunctionData(
    "updatePackageCap",
    [packageId, liquidityCap, feeCap, userFeePct]
  );

  const dataToSave = { calldata };
  fs.writeFileSync(
    path.join(__dirname, `../UpdatePackageCap-rawData.json`),
    JSON.stringify(dataToSave, null, 2)
  );

  console.log("✅ Encoded calldata saved.");
}

async function encodeMigratePositionBatches() {


  const contractName = "AggregatorUpgradeable";
  const contractAddress = await getDeploymentAddress(contractName);
  const contract = await hre.ethers.getContractAt(contractName, contractAddress);

  const users = process.env.MIGRATE_USERS ? process.env.MIGRATE_USERS.split(',').map(u => u.trim()) : [];
  const manager = process.env.MIGRATE_MANAGER;
  const poolId = process.env.MIGRATE_POOL_ID;
  const packageIds = process.env.MIGRATE_PACKAGE_IDS ? process.env.MIGRATE_PACKAGE_IDS.split(',').map(p => p.trim()) : [];
  const tickLower = process.env.MIGRATE_TICK_LOWER;
  const tickUpper = process.env.MIGRATE_TICK_UPPER;

  console.log("Users:", users);
  console.log("Manager:", manager);
  console.log("Pool ID:", poolId);
  console.log("Package IDs:", packageIds);
  console.log("Tick Lower:", tickLower);
  console.log("Tick Upper:", tickUpper);

  const calldata = contract.interface.encodeFunctionData(
    "migratePositionBatches",
    [users, manager, poolId, packageIds, tickLower, tickUpper]
  );

  const dataToSave = { calldata };
  fs.writeFileSync(
    path.join(__dirname, `../MigratePositionBatches-rawData.json`),
    JSON.stringify(dataToSave, null, 2)
  );

  console.log("✅ Encoded calldata saved.");
}

async function proposeEmergencyWithdraw() {
  const safeAddress = await getSafeAddress();
  const proposerAddress = process.env.PROPOSER_ADDRESS;
  const proposerPrivateKey = process.env.PROPOSER_PRIVATE_KEY;
  const RPC = process.env.ARBITRUM_MAINNET_RPC_URL;

  const protocolProposer = await Safe.init({
    provider: RPC,
    signer: proposerPrivateKey,
    safeAddress
  });

  const rawData = JSON.parse(fs.readFileSync("EmergencyWithdraw-rawData.json"));

  const safeTransactionData = {
    to: process.env.VAULT_MANAGER_ADDRESS,
    value: "0",
    data: rawData.calldata,
    operation: OperationType.Call,
  };

  const safeTransaction = await protocolProposer.createTransaction({
    transactions: [safeTransactionData]
  });

  const apiKit = new SafeApi({
    chainId: 42161n,
    apiKey: process.env.SAFE_API_KEY
  });

  const safeTxHash = await protocolProposer.getTransactionHash(safeTransaction);
  const senderSignature = await protocolProposer.signHash(safeTxHash);

  await apiKit.proposeTransaction({
    safeAddress,
    safeTransactionData: safeTransaction.data,
    safeTxHash,
    senderAddress: proposerAddress,
    senderSignature: senderSignature.data
  });

  console.log("✅ Transaction Proposed:", safeTxHash);
}

async function signPendingSafeTransaction() {
  try {
    const safeAddress = await getSafeAddress();
    const rpcUrl = process.env.ARBITRUM_MAINNET_RPC_URL;
    const signerPrivateKey = process.env.SIGNER_PRIVATE_KEY;

    const apiKit = new SafeApi({
      chainId: 42161n,
      apiKey: process.env.SAFE_API_KEY
    });

    console.log("Safe Address: ", safeAddress);

    const pending = await apiKit.getPendingTransactions(safeAddress);
    if (pending.results.length === 0) {
      console.log("No pending transactions available");
      return;
    }

    const txInfo = pending.results[0];
    console.log("Signing tx:", txInfo.safeTxHash);

    const safe = await Safe.init({
      provider: rpcUrl,
      signer: signerPrivateKey,
      safeAddress
    });

    const safeTransactionData = {
      to: txInfo.to,
      value: txInfo.value,
      data: txInfo.data || "0x",
      operation: txInfo.operation,
      safeTxGas: txInfo.safeTxGas,
      baseGas: txInfo.baseGas,
      gasPrice: txInfo.gasPrice,
      gasToken: txInfo.gasToken,
      refundReceiver: txInfo.refundReceiver,
      nonce: txInfo.nonce,
    };

    const safeTransaction = await safe.createTransaction({
      transactions: [safeTransactionData]
    });
    const txHashToSign = await safe.getTransactionHash(safeTransaction);
    console.log("📝 Tx Hash to Sign:", txHashToSign);

    const signerSignature = await safe.signHash(txHashToSign);
    console.log("✍ Signature:", signerSignature.data);

    await apiKit.confirmTransaction(txInfo.safeTxHash, signerSignature.data);
    console.log("✅ Signature submitted to Safe API");

  } catch (err) {
    console.error("Error in signPendingSafeTransaction:", err);
  }
}

async function executeSafeTransaction() {
  try {
    const safeAddress = await getSafeAddress();
    const rpcUrl = process.env.ARBITRUM_MAINNET_RPC_URL;
    let provider = new hre.ethers.JsonRpcProvider(rpcUrl);

    const executorPrivateKey = process.env.EXECUTOR_PRIVATE_KEY;
    
    const apiKit = new SafeApi({
      chainId: 42161n,
      apiKey: process.env.SAFE_API_KEY
    });

    const pending = await apiKit.getPendingTransactions(safeAddress);

    if (pending.results.length === 0) {
      console.log("❌ No pending transactions to execute.");
      return;
    }

    const txInfo = pending.results[0];
    console.log("🚀 Executing safeTxHash:", txInfo.safeTxHash);


    const safe = await Safe.init({
      safeAddress,
      provider: rpcUrl,
      signer: executorPrivateKey
    });


    const ZERO = "0x0000000000000000000000000000000000000000";
    const d = txInfo;
    const safeTransactionData = {
      to: d?.to ?? ZERO,
      value: d?.value ?? "0",
      data: d?.data ?? "0x",
      operation: d?.operation ?? 0,
      safeTxGas: d.safeTxGas ?? 0,
      baseGas: d?.baseGas ?? 0,
      gasPrice: d?.gasPrice ?? 0,
      gasToken: d?.gasToken ?? ZERO,
      refundReceiver: d?.refundReceiver ?? ZERO,
      nonce: txInfo.nonce ?? 0
    };

    const safeTransaction = await safe.createTransaction({
      transactions: [safeTransactionData]
    });

    const signatureBundle = await apiKit.getTransactionConfirmations(txInfo.safeTxHash);

    for (const sig of signatureBundle.results) {
      const safeSig = new EthSafeSignature(sig.owner, sig.signature);
      safeTransaction.addSignature(safeSig);
    }

    const txResponse = await safe.executeTransaction(safeTransaction);
    console.log("⛽ Submitted tx:", txResponse.hash);

    const receipt = await provider.waitForTransaction(txResponse.hash);
    console.log("✅ Tx Confirmed in block:", receipt.blockNumber);

  } catch (err) {
    console.error("Error in executeSafeTransaction:", err);
  }
}

const functionName = process.env.FUNCTION_NAME;

const functions = {
  encodeEmergencyWithdraw,
  encodeSetMaxWithdrawalSize,
  encodeSetProtocolConfig,
  encodeWithdrawCompanyFees,
  encodeEmergencyNFTWithdraw,
  encodeSetMaxMigrationSize,
  encodeSetUserManagerAddress,
  encodeSetTokenOracles,
  encodeSetTWAPWindow,
  encodeSetSlippageParameters,
  encodeSetAddress,
  encodeSetUint,
  encodeSetUserPackage,
  encodeSetPackageCap,
  encodeUpdatePackageCap,
  encodeMigratePositionBatches,
  proposeEmergencyWithdraw,
  signPendingSafeTransaction,
  executeSafeTransaction
};

if (functionName && functions[functionName]) {
  console.log(`Executing ${functionName}...`);
  functions[functionName]()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(`Error in ${functionName}:`, error);
      process.exit(1);
    });
} else {
  console.error('Please provide a valid function name. Available functions:');
  console.error(Object.keys(functions).join('\n'));
  process.exit(1);
}



