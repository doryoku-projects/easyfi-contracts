var hre = require("hardhat");
const fs = require("fs");
const path = require("path");

const CONFIG = require("../launch/config");

const getSafeAddress = async () => {
  const network = await hre.ethers.provider.getNetwork();
  const chainId = Number(network.chainId);
  return CONFIG.ADDRESSES_PER_CHAIN[chainId]?.SAFE_ADDRESS;
};

const abi = [
  "function upgradeToAndCall(address newImplementation, bytes data)"
];

var {default: SafeApi} = require("@safe-global/api-kit")
var safe = require("@safe-global/protocol-kit")
var {OperationType,MetaTransactionData} = require("@safe-global/types-kit");
const { default: Safe, EthSafeSignature } = require("@safe-global/protocol-kit");


async function newImplementation(){
    let provider = new hre.ethers.JsonRpcProvider(process.env.ARBITRUM_MAINNET_RPC_URL);
    let wallet = new hre.ethers.Wallet(process.env.MASTER_ADMIN_PRIVATE_KEY,provider);
    const contractName = process.env.CONTRACT;
    let contract = await hre.ethers.getContractFactory(contractName, wallet);
    let impl = await contract.deploy();
    console.log("Deploying new implementation...");
    await impl.waitForDeployment();
    let newImp =  await impl.getAddress();
    let iface = new hre.ethers.Interface(abi)
    const data = "0x";
    const calldata = iface.encodeFunctionData("upgradeToAndCall", [newImp, data]);

    let dataToSave = {
        newImplementation: newImp,
        calldata: calldata
    }

    const filePath = path.join(__dirname, `../${contractName}-rawData.json`);
    fs.writeFileSync(filePath, JSON.stringify(dataToSave, null, 2));
    console.log("Data saved to:", filePath);


}   

async function proposeExecute() {
  const safeAddress = await getSafeAddress();
  const proposerAddress = process.env.PROPOSER_ADDRESS;
  const proposerPrivateKey = process.env.PROPOSER_PRIVATE_KEY;
  const RPC = process.env.ARBITRUM_MAINNET_RPC_URL

  const protocolProposer = await Safe.init({
    provider: RPC,
    signer: proposerPrivateKey,
    safeAddress: safeAddress,
  });

  let rawData = fs.readFileSync("UserManagerUpgradeable-rawData.json");
  let jsonData = JSON.parse(rawData);
  console.log(jsonData)
  const safeTransactionData = {
    to: process.env.USER_MANAGER_ADDRESS,
    value: "0",
    data: jsonData.calldata,
    operation: OperationType.Call,
  };

  const safeTransactions = await protocolProposer.createTransaction({
    transactions: [safeTransactionData],
  })

  const apiKit = new SafeApi({
    apiKey: process.env.SAFE_API_KEY,
    chainId: 42161n
  })
  let safeTxHash = await protocolProposer.getTransactionHash(safeTransactions);
  let senderSignature = await protocolProposer.signHash(safeTxHash);
console.log("sender signature: ",senderSignature)
 let res =  await apiKit.proposeTransaction({
  safeAddress,
  safeTransactionData: safeTransactions.data,
  safeTxHash,
  senderAddress: proposerAddress,
  senderSignature: senderSignature.data
})

console.log("result: ",res)

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
    const executorPrivateKey = process.env.EXECUTOR_PRIVATE_KEY; // MUST be an owner OR delegate

    const apiKit = new SafeApi({
      chainId: 42161n, // Arbitrum
      apiKey: process.env.SAFE_API_KEY
    });

    // 1) Fetch pending transaction
    const pending = await apiKit.getPendingTransactions(safeAddress);

    if (pending.results.length === 0) {
      console.log("❌ No pending transactions to execute.");
      return;
    }

    const txInfo = pending.results[0];
    console.log("🚀 Executing safeTxHash:", txInfo.safeTxHash);

    // 2) Reconstruct Safe + Transaction
    const safe = await Safe.init({
      safeAddress,
      provider: rpcUrl,
      signer: executorPrivateKey
    });

    // Re-construct transaction data in the correct format
    const ZERO = "0x0000000000000000000000000000000000000000";
    const d = txInfo;
    const safeTransactionData = {
      to: d?.to ?? ZERO,
      value: d?.value ?? "0",
      data: d?.data ?? "0x",
      operation: d?.operation ?? 0,
      safeTxGas: d?.safeTxGas ?? 0,
      baseGas: d?.baseGas ?? 0,
      gasPrice: d?.gasPrice ?? 0,
      gasToken: d?.gasToken ?? ZERO,
      refundReceiver: d?.refundReceiver ?? ZERO,
      nonce: txInfo.nonce ?? 0
    };

    const safeTransaction = await safe.createTransaction({
      transactions: [safeTransactionData]
    });

    // 3) Combine existing signatures from Safe Transaction Service
    const signatureBundle = await apiKit.getTransactionConfirmations(txInfo.safeTxHash);

    for (const sig of signatureBundle.results) {
      const safeSig = new EthSafeSignature(sig.owner, sig.signature);
      safeTransaction.addSignature(safeSig);
    }

    // 4) Execute
    const txResponse = await safe.executeTransaction(safeTransaction);
    console.log("⛽ Submitted tx:", txResponse.hash);

    const receipt = await provider.waitForTransaction(txResponse.hash);
    console.log("✅ Tx Confirmed in block:", receipt.blockNumber);

  } catch (err) {
    console.error("Error in executeSafeTransaction:", err);
  }
}


async function getUserMangerVersion(){
    let provider = new hre.ethers.JsonRpcProvider(process.env.ARBITRUM_MAINNET_RPC_URL);
    let wallet = new hre.ethers.Wallet(process.env.USER_MANAGER_PRIVATE_KEY,provider);
    let contractAddress = process.env.USER_MANAGER_ADDRESS; // UserManagerUpgradeable
    let contract = await hre.ethers.getContractAt("UserManagerUpgradeable",contractAddress,wallet);
    let masterAdminBytes = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("MASTER_ADMIN_ROLE"));
    console.log("Role Hash: ",masterAdminBytes);
    let tx = await contract.connect(wallet).getRoleMembers(masterAdminBytes);
    let tx2 = await contract.getVersion();
    console.log("Version: ",tx2);
    console.log("Master Admins: ",tx);
}


const functionName = process.env.FUNCTION_NAME;

const functions = {
  newImplementation,
  proposeExecute,
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