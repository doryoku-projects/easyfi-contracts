var hre = require("hardhat");
const fs = require("fs");
const path = require("path");
let contractName = "VaultManagerUpgradeable";

var {default: SafeApi} = require("@safe-global/api-kit")
var safe = require("@safe-global/protocol-kit")
var {OperationType,MetaTransactionData} = require("@safe-global/types-kit");
const { default: Safe, EthSafeSignature } = require("@safe-global/protocol-kit");

async function encodeEmergencyWithdraw() {
  const provider = new hre.ethers.JsonRpcProvider(process.env.ARBITRUM_MAINNET_RPC_URL);
  const wallet = new hre.ethers.Wallet(process.env.MASTER_ADMIN_PRIVATE_KEY, provider);

  const contractAddress = process.env.VAULT_MANAGER_ADDRESS;
  const contract = await hre.ethers.getContractAt(contractName, contractAddress, wallet);

  const tokens = [
    "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
  ];

  const to = "0x0ca5D3f01A5534B516Dc9cEAC8D2C53de1245541";

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

async function proposeEmergencyWithdraw() {
  const safeAddress = "0x549BB741bDAE87872d0bb7082Ee6223D02644963";
  const proposerAddress = "0x69531380bF6fFcc7aaA2d3e3e75b98a345bd4c10";
  const proposerPrivateKey = "";
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
    const safeAddress = ethers.getAddress("0x549BB741bDAE87872d0bb7082Ee6223D02644963");
    const rpcUrl = process.env.ARBITRUM_MAINNET_RPC_URL;
    const signerPrivateKey = "";

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
    const safeAddress = "0x549BB741bDAE87872d0bb7082Ee6223D02644963";
    const rpcUrl = process.env.ARBITRUM_MAINNET_RPC_URL;
    let provider = new hre.ethers.JsonRpcProvider(rpcUrl);

    const executorPrivateKey = "";
    
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

encodeEmergencyWithdraw().then(() => process.exit(0)).catch((error) => {
  console.error("Error in newImplementation:", error);
  process.exit(1);
});

proposeEmergencyWithdraw().then(() => process.exit(0)).catch((error) => {
  console.error("Error in execute:", error);
  process.exit(1);
});

signPendingSafeTransaction().then(() => process.exit(0)).catch((error) => {
  console.error("Error in signPendingSafeTransaction:", error);
  process.exit(1);
});

executeSafeTransaction().then(() => process.exit(0)).catch((error) => {
  console.error("Error in executeSafeTransaction:", error);
  process.exit(1);
});



