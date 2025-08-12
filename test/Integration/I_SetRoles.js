const { expect } = require("chai");
const { ethers } = require("hardhat");
require("dotenv").config();

describe("I_setRoles", function () {
  let ownerWallet, userWallet, pepOwnerWallet, marcWallet;
  let userManagerGeneralAdmin, userManagerUserManager;
  const userManagerAddress = process.env.USER_MANAGER_ADDRESS;
  const vaultManagerAddress = process.env.VAULT_MANAGER_ADDRESS;
  const liquidityManagerAddress = process.env.LIQUIDITY_MANAGER_ADDRESS;
  const oracleSwapAddress = process.env.ORACLE_SWAP_ADDRESS;
  const liquidityHelperAddress = process.env.LIQUIDITY_HELPER_ADDRESS;
  const aggregatorAddress = process.env.AGGREGATOR_ADDRESS;
  const token0Address = "0x82af49447d8a07e3bd95bd0d56f35241523fbab1"; // e.g. WETH ARBITRUM
  const token1Address = "0xaf88d065e77c8cC2239327C5EDb3A432268e5831"; // e.g. USDC ARBITRUM
  const ethPriceFeed = "0x639Fe6ab55C921f74e7fac1ee960C0B6293ba612"; // ARBITRUM ORACLE CHAINLINK ETH
  const usdcPriceFeed = "0x50834F3163758fcC1Df9973b6e91f0F0F0434aD3"; // ARBITRUM ORACLE CHAINLINK USDC
  before(async function () {
    ownerWallet = new ethers.Wallet( // MASTER_ADMIN
      process.env.MASTER_ADMIN_PRIVATE_KEY,
      ethers.provider
    );

    marcWallet = new ethers.Wallet( // GENERAL_ADMIN
      process.env.GENERAL_ADMIN_PRIVATE_KEY,
      ethers.provider
    );

    pepOwnerWallet = new ethers.Wallet( // USER_MANAGER
      process.env.USER_MANAGER_PRIVATE_KEY,
      ethers.provider
    );

    userWallet = new ethers.Wallet( // NORMAL USER, WHO INTERACTS WITH AGREGATOR
      process.env.USER_PRIVATE_KEY,
      ethers.provider
    );

    userManagerGeneralAdmin = await ethers.getContractAt(
      "UserManagerUpgradeable",
      userManagerAddress,
      marcWallet
    );

    userManagerUserManager = await ethers.getContractAt(
      "UserManagerUpgradeable",
      userManagerAddress,
      pepOwnerWallet
    );

    userManagerMasterAdmin = await ethers.getContractAt(
      "UserManagerUpgradeable",
      userManagerAddress,
      ownerWallet
    );

    const key = (s) => ethers.keccak256(ethers.toUtf8Bytes(s));

    const rolesKeys = [
      "MASTER_ADMIN_ROLE",
      "GENERAL_ADMIN_ROLE",
      "USER_MANAGER_ROLE",
      "LIQUIDITY_MANAGER_ROLE",
      "VAULT_MANAGER_ROLE",
      "USER_ROLE",
      "USER_2FA_ROLE",
      "CONTRACT_ROLE",
    ].map(key);


    const tx =await userManagerGeneralAdmin.addUsersManager([
      pepOwnerWallet.address,
    ]);
    await tx.wait();
    console.log("User Manager added:", pepOwnerWallet.address);

    //Obtaining all the wallets x each role
    const allMasterAdmins = await userManagerGeneralAdmin.getRoleMembers(
      rolesKeys[0]
    );
    console.log("Master Admins:", allMasterAdmins);

    const allAdmins = await userManagerGeneralAdmin.getRoleMembers(rolesKeys[1]);
    console.log("Admins:", allAdmins);

    const allUserManagers = await userManagerGeneralAdmin.getRoleMembers(
      rolesKeys[2]
    );
    console.log("User Managers:", allUserManagers);

    const allLiquidityManagers = await userManagerGeneralAdmin.getRoleMembers(
      rolesKeys[3]
    );
    console.log("Liquidity Managers:", allLiquidityManagers);

    const allVaultManagers = await userManagerGeneralAdmin.getRoleMembers(
      rolesKeys[4]
    );
    console.log("Vault Managers:", allVaultManagers);

    const allUsers = await userManagerGeneralAdmin.getRoleMembers(rolesKeys[5]);
    console.log("Users:", allUsers);

    const all2FAManagers = await userManagerGeneralAdmin.getRoleMembers(
      rolesKeys[6]
    );
    console.log("2FA Managers:", all2FAManagers);

    const allContracts = await userManagerGeneralAdmin.getRoleMembers(
      rolesKeys[7]
    );
    console.log("Contracts:", allContracts);

  });

  it("Should assign roles correctly", async function () {
  //  Assign the Liquidity Manager role to the Vault,LiquidityHelper,LiquidityManager, OracleSwap contracts
    // await expect(
    //   userManagerGeneralAdmin.addLiquidityManagers([
    //     vaultManagerAddress,
    //     liquidityHelperAddress,
    //     liquidityManagerAddress,
    //     oracleSwapAddress,
    //   ])
    // ).to.emit(userManagerGeneralAdmin, "LiquidityManagerAdded");

    // await expect(userManagerGeneralAdmin.addUsersManager([pepOwnerWallet.address]))
    //   .to.emit(userManagerGeneralAdmin, "UserManagerAdded");


    // const isLM1 = await userManagerUserManager.isLiquidityManager(
    //   liquidityHelperAddress
    // );
    // expect(isLM1).to.be.true;

    // const isLM2 = await userManagerUserManager.isLiquidityManager(
    //   liquidityManagerAddress
    // );
    // expect(isLM2).to.be.true;

    // const isLM3 = await userManagerUserManager.isLiquidityManager(
    //   oracleSwapAddress
    // );
    // expect(isLM3).to.be.true;

    // Assign the Vault Manager role to the Aggregator contract
    await expect(
      userManagerGeneralAdmin.addVaultManagers([aggregatorAddress])
    ).to.emit(userManagerGeneralAdmin, "VaultManagerAdded");

    const isVaultManager = await userManagerUserManager.isVaultManager(
      aggregatorAddress
    );
    expect(isVaultManager).to.be.true;

    // Assign the user role to the userWallet
    await expect(userManagerUserManager.addUsers([userWallet.address])).to.emit(
      userManagerUserManager,
      "UserAdded"
    );
    const isUser = await userManagerUserManager.isUser(userWallet.address);
    expect(isUser).to.be.true;



    // Assign the UserManager role to the Aggregator contract
    await expect(
      userManagerUserManager.addUsersManager([aggregatorAddress])
    ).to.emit(userManagerGeneralAdmin, "UserManagerAdded");
    const isUserManager = await userManagerUserManager.isUserManager(
      aggregatorAddress
    );
    expect(isUserManager).to.be.true;
  
  });

  // it.only("Should remove master admins", async function () {


  //   userManagerMasterAdmin.removeMasterAdmins(["0x2452bf5b70dd773874317454dd1ecb31db2f8d3c"]);
  //   const isMasterAdmin = await userManagerUserManager.isMasterAdmin(
  //     "0x2452bf5b70dd773874317454dd1ecb31db2f8d3c"
  //   );
  //   console.log("Is Master Admin:", isMasterAdmin);

  // });


  it("Should set all necessary contract addresses for correct interaction", async function () {
    const OracleSwap = await ethers.getContractAt(
      "OracleSwapUpgradeable",
      oracleSwapAddress,
      ownerWallet
    );

    const tokens = [token0Address, token1Address];
    const oracles = [ethPriceFeed, usdcPriceFeed];
    const txOracle = await OracleSwap.setTokenOracles(tokens, oracles);
    await txOracle.wait();
    console.log("Oracles set successfully:");
    console.log(
      `Token0: ${token0Address} -> ${await OracleSwap.getTokenOracle(
        token0Address
      )}`
    );
    console.log(
      `Token1: ${token1Address} -> ${await OracleSwap.getTokenOracle(
        token1Address
      )}`
    );
  });
});
