var hre = require("hardhat");
const fs = require("fs");
const path = require("path");
let contractName = "UserManagerUpgradeable"; // replace with your contract name
const abi = [
  "function upgradeToAndCall(address newImplementation, bytes data)"
];

async function newImplementation(){
    let provider = new hre.ethers.JsonRpcProvider(process.env.ARBITRUM_MAINNET_RPC_URL);
    let wallet = new hre.ethers.Wallet(process.env.MASTER_ADMIN_PRIVATE_KEY,provider);
    let contract = await hre.ethers.getContractFactory(contractName,wallet);
    let impl = await contract.deploy();
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

newImplementation().then(() => process.exit(0)).catch((error) => {
  console.error("Error in newImplementation:", error);
  process.exit(1);
});




