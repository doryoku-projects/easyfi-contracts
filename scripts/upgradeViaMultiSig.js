var hre = require("hardhat");
const fs = require("fs");
const path = require("path");
let contractName = "UserManagerUpgradeable"; // replace with your contract name
const abi = [
  "function upgradeToAndCall(address newImplementation, bytes data)"
];

var {default: SafeApi} = require("@safe-global/api-kit")
var safe = require("@safe-global/protocol-kit")
var {OperationType,MetaTransactionData} = require("@safe-global/types-kit");
const { default: Safe } = require("@safe-global/protocol-kit");
async function newImplementation(){
    let provider = new hre.ethers.JsonRpcProvider(process.env.ARBITRUM_MAINNET_RPC_URL);
    let wallet = new hre.ethers.Wallet(process.env.MASTER_ADMIN_PRIVATE_KEY,provider);
    let contract = await hre.ethers.getContractFactory(contractName,wallet);
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

async function execute() {
  const safeAddress = "0x5a12c37653c862E2546b54520c33cD2F64531320"
  const proposerAddress = "0x9287B1F2Db0ecf9b9748E534D38617240c8F9e56"
  const proposerPrivateKey = "edc24abbef4c2cecdf5e6a4ed2f638f476994f12c31eb938d2bd53bc9df6519b"
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
// newImplementation().then(() => process.exit(0)).catch((error) => {
//   console.error("Error in newImplementation:", error);
//   process.exit(1);
// });

// execute().then(() => process.exit(0)).catch((error) => {
//   console.error("Error in execute:", error);
//   process.exit(1);
// });

// getUserMangerVersion().then(() => process.exit(0)).catch((error) => {
//   console.error("Error in getUserMangerVersion:", error);
//   process.exit(1);
// });



