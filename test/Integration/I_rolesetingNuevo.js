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
  const token0Address = "0x82af49447d8a07e3bd95bd0d56f35241523fbab1"; // e.g. WETH
  const token1Address = "0xaf88d065e77c8cC2239327C5EDb3A432268e5831"; // e.g. USDC
  const ethPriceFeed = "0x639Fe6ab55C921f74e7fac1ee960C0B6293ba612";
  const usdcPriceFeed = "0x50834F3163758fcC1Df9973b6e91f0F0F0434aD3";

  async function fundWallet() {
    console.log("Funding wallet...")
    const routerABI = [
      "function exactInputSingle((address,address,uint24,address,uint256,uint256,uint256,uint160)) payable returns (uint256 amountOut)"
    ];

    const UNISWAP_V3_ROUTER = process.env.SWAP_ROUTER_ADDRESS;
    const router = await ethers.getContractAt(routerABI, UNISWAP_V3_ROUTER);
    const amountIn = ethers.parseEther("1");
    const params = [
      token0Address,
      token1Address,
      500,
      userWallet.address,
      Math.floor(Date.now() / 1000) + 60 * 10,
      amountIn,
      0,
      0
    ]

    const tx = await router.exactInputSingle(params, { value: amountIn });
    await tx.wait();
  }

  before(async function () {
    ownerWallet = new ethers.Wallet(       // MASTER_ADMIN
      process.env.MASTER_ADMIN_PRIVATE_KEY,
      ethers.provider
    );

    marcWallet = new ethers.Wallet(       // GENERAL_ADMIN
      process.env.GENERAL_ADMIN_PRIVATE_KEY,
      ethers.provider
    );

    pepOwnerWallet = new ethers.Wallet(     // USER_MANAGER
      process.env.USER_MANAGER_PRIVATE_KEY,
      ethers.provider
    );

    userWallet = new ethers.Wallet(       // NORMAL USER, WHO INTERACTS WITH AGREGATOR
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

    //Obtaining all the wallets x each role
    const allMasterAdmins = await userManagerUserManager.getRoleMembers(
      rolesKeys[0]
    );
    console.log("allMasterAdmins", allMasterAdmins);
    const allAdmins = await userManagerUserManager.getRoleMembers(rolesKeys[1]);
    console.log("allAdmins", allAdmins);
    const allUserManagers = await userManagerUserManager.getRoleMembers(
      rolesKeys[2]
    );
    console.log("allUserManagers", allUserManagers);
    const allLiquidityManagers = await userManagerUserManager.getRoleMembers(
      rolesKeys[3]
    );
    console.log("allLiquidityManagers", allLiquidityManagers);
    const allVaultManagers = await userManagerUserManager.getRoleMembers(
      rolesKeys[4]
    );
    console.log("allVaultManagers", allVaultManagers);
    const allUsers = await userManagerUserManager.getRoleMembers(rolesKeys[5]);
    console.log("allUsers", allUsers);
    const all2FAManagers = await userManagerUserManager.getRoleMembers(
      rolesKeys[6]
    );
    console.log("all2FAManagers", all2FAManagers);
    const allContracts = await userManagerUserManager.getRoleMembers(
      rolesKeys[7]
    );
    console.log("allContracts", allContracts);

    console.log("Master Admins:", allMasterAdmins);
    console.log("Admins:", allAdmins);
    console.log("User Managers:", allUserManagers);
    console.log("Liquidity Managers:", allLiquidityManagers);
    console.log("Vault Managers:", allVaultManagers);
    console.log("Users:", allUsers);
    console.log("2FA Managers:", all2FAManagers);
    console.log("Contracts:", allContracts);
  });

  it("Should assign roles correctly", async function () {
    //  Assign the Liquidity Manager role to the Vault,LiquidityHelper,LiquidityManager, OracleSwap contracts
    process.env.APP_ENV === "development" && await fundWallet();
    await expect(
      userManagerGeneralAdmin.addLiquidityManagers([
        vaultManagerAddress,
        liquidityHelperAddress,
        liquidityManagerAddress,
        oracleSwapAddress,
      ])
    ).to.emit(userManagerGeneralAdmin, "LiquidityManagerAdded");

    const isLM1 = await userManagerUserManager.isLiquidityManager(
      liquidityHelperAddress
    );
    expect(isLM1).to.be.true;

    const isLM2 = await userManagerUserManager.isLiquidityManager(
      liquidityManagerAddress
    );
    expect(isLM2).to.be.true;

    const isLM3 = await userManagerUserManager.isLiquidityManager(
      oracleSwapAddress
    );
    expect(isLM3).to.be.true;

    // Assign the Vault Manager role to the Aggregator contract
    await expect(
      userManagerGeneralAdmin.addVaultManagers([aggregatorAddress, vaultManagerAddress])
    ).to.emit(userManagerGeneralAdmin, "VaultManagerAdded");

    let isVaultManager = await userManagerUserManager.isVaultManager(
      aggregatorAddress
    );
    expect(isVaultManager).to.be.true;

    isVaultManager = await userManagerUserManager.isVaultManager(
      vaultManagerAddress
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
    //   await expect(
    //     userManagerUserManager.addUsersManager([aggregatorAddress])
    //   ).to.emit(userManagerGeneralAdmin, "UserManagerAdded");
    //   const isUserManager = await userManagerUserManager.isUserManager(
    //     aggregatorAddress
    //   );
    //   expect(isUserManager).to.be.true;

  });

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



