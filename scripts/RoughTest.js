const { ethers,upgrades ,network } = require("hardhat");
require("dotenv").config();

async function main() {
  const UserManagerUpgradeable = "0x3E74313B3EbCEdebe14A2D53d824b5e441a0CE4c";
  const ProtocolConfigUpgradeable = "0x0e40D9e07cFf8459c2a3AeB3624540F517aE26E6";
  const VaultUpgradeable = "0x29f3e74d5985660673be13Fb777d417f520e524f";
  const LiquidityManagerUpgradeable = "0x00fb0D85f230055D66Faf2F2986dE197DE7aDCB2";
  const OracleSwapUpgradeable = "0xA642172faA8376dCc258f857f1d79ad0952CD9c3";
  const LiquidityHelperUpgradeable = "0x34e605B4CE38A5eb9aF3C941C514B9A776077632";
  const AggregatorUpgradeable = "0x58F8c4B5362494f37f88185e5cA22b9e3352aF3B";
  const MainMasterAdmin = "0xaBdCd4b8a234188598D8050031326A0aaa1429A5";
  const clientAddress = process.env.CLIENT_ADDRESS;

  // impersonate the admin
  await network.provider.request({
    method: "hardhat_impersonateAccount",
    params: [MainMasterAdmin],
  });
  await network.provider.send("hardhat_setBalance", [
    MainMasterAdmin,
    "0x1000000000000000000", // some ETH
  ]);

  let proxyAddress = VaultUpgradeable;


  const adminSigner = await ethers.getSigner(MainMasterAdmin);
const implementationAddress = await upgrades.erc1967.getImplementationAddress(proxyAddress);
console.log("Current implementation address:", implementationAddress);

const VaultManagerUpgradeableFactory = await ethers.getContractFactory("VaultManagerUpgradeable", { signer: adminSigner });

console.log("[UPGRADE] Registering proxy...");
// First register the existing proxy
await upgrades.forceImport(proxyAddress, VaultManagerUpgradeableFactory);

await upgrades.prepareUpgrade(proxyAddress, VaultManagerUpgradeableFactory);
console.log("[UPGRADE] Upgrading proxy contract...");
// Now upgrade it
const upgradedVault = await upgrades.upgradeProxy(proxyAddress, VaultManagerUpgradeableFactory,{redeployImplementation:"always"});
console.log("[UPGRADE] Proxy contract updated at:", await upgradedVault.getAddress());

// Check new implementation
const newImplementationAddress = await upgrades.erc1967.getImplementationAddress(proxyAddress);
console.log("New implementation address:", newImplementationAddress);



  // your real wallet (to be added as admin)
  const myWallet = new ethers.Wallet(
    process.env.MASTER_ADMIN_PRIVATE_KEY,
    ethers.provider
  );

  // contract instances
  const UserManager = await ethers.getContractAt(
    "UserManagerUpgradeable",
    UserManagerUpgradeable,
    adminSigner
  );
  const ProtocolConfig = await ethers.getContractAt(
    "ProtocolConfigUpgradeable",
    ProtocolConfigUpgradeable,
    adminSigner
  );
  const Vault = await ethers.getContractAt(
    "VaultManagerUpgradeable",
    VaultUpgradeable,
    myWallet
  );

  // add my wallet as master admin
  const tx = await UserManager.addMasterAdmins([myWallet.address]);
  await tx.wait();
  console.log("Added my wallet as Master Admin in UserManager:", tx.hash);

  // // set protocol config
  const keyClient = ethers.keccak256(ethers.toUtf8Bytes("ClientAddress"));
  const keyFee = ethers.keccak256(ethers.toUtf8Bytes("ClientFeePct"));
  const keyCompany = ethers.keccak256(ethers.toUtf8Bytes("CompanyFeePct"));

   const tx2 = await ProtocolConfig.setAddress(keyClient, clientAddress);
   await tx2.wait();

   const tx3 = await ProtocolConfig.setUint(keyFee, 5000);
  await tx3.wait();

  const tx4 = await ProtocolConfig.setUint(keyCompany, 5000);
   await tx4.wait();

   // console.log("get client fee from protocol config:", (await ProtocolConfig.getUint(keyFee)).toString());

  // console.log("Set Client Address and Client Fee in ProtocolConfig:", tx2.hash, tx3.hash, tx4.hash);

  // check company fees

  const companyFees = await Vault.getCompanyFees();
  console.log("Company Fees in Vault before withdrawal:", companyFees.toString());

  //checking the role

  const MASTER_ADMIN_ROLE = ethers.keccak256(ethers.toUtf8Bytes("MASTER_ADMIN_ROLE"));
  console.log("MASTER_ADMIN_ROLE:", MASTER_ADMIN_ROLE);
console.log("Is myWallet master admin?", await UserManager.hasRole(MASTER_ADMIN_ROLE, myWallet.address));


  // doing signature for withdrawal of company fees
      // doing this signature for withdrawal of company fees
  await UserManager.addUser2FAs([myWallet.address]);// need to comment out when executing first time after deployment


    let block = await ethers.provider.getBlock("latest");
    let timestamp = block.timestamp + 2600;
    console.log("Current block timestamp:", timestamp);

    let messageHash = ethers.solidityPackedKeccak256(
      ["address", "uint256", "uint256"],
      [myWallet.address,5000, timestamp]
    );
        const valid2FACode = "123456";


    let signature = await myWallet.signMessage(ethers.getBytes(messageHash));
      await UserManager.connect(myWallet).set2FA(
      myWallet.address,
      valid2FACode ,
      timestamp,
      5000,
      signature);
//client fee



  // withdraw company fees
const iface = new ethers.Interface([
  "function withdrawCompanyFees(string calldata code) external"
]);

const data = iface.encodeFunctionData("withdrawCompanyFees", [valid2FACode]);

const tx5 = await myWallet.sendTransaction({
  to: VaultUpgradeable,
  data: data
});

await tx5.wait();
console.log("Withdrew company fees. Transaction hash:", tx5.hash);
  console.log("Withdraw Company Fees:", tx5.hash);
//balance for client in usdc
const mainToken = await ethers.getContractAt("IERC20", process.env.MAIN_TOKEN_ADDRESS, myWallet);

const clientBalance = await mainToken.balanceOf(clientAddress);
console.log("Client balance in USDC:", clientBalance.toString());

//company fee

const companyFeesAfter = await Vault.getCompanyFees();
console.log("Company Fees in Vault after withdrawal:", companyFeesAfter.toString());
let adminBalance = await mainToken.balanceOf(myWallet.address);
console.log("admin fees in vault after withdrawal:", adminBalance.toString());
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});









