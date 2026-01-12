const { expect } = require("chai");
const { ethers } = require("hardhat");
require("dotenv").config();

const CONFIG = require("../../launch/config");

const { getDeploymentAddress } = require("../../launch/DeploymentStore");

describe("I_setRoles", async function () {
  let ownerWallet, userWallet, pepOwnerWallet, marcWallet;
  let userManagerGeneralAdmin, userManagerUserManager;
  let userManagerAddress, vaultManagerAddress, liquidityManagerAddress;
  let oracleSwapAddress, liquidityHelperAddress, aggregatorAddress;
  let addressesPerChain, wethAddress, usdcAddress, daiAddress, wbtcAddress, ethPriceFeed, usdcPriceFeed, wbtcPriceFeed, daiPriceFeed;
  async function fundWallet() {

    console.log("Funding wallet...")
    const routerABI = [
      "function exactInputSingle((address,address,uint24,address,uint256,uint256,uint160)) payable returns (uint256 amountOut)"
    ];

    const UNISWAP_V3_ROUTER = addressesPerChain.SWAP_ROUTER_ADDRESS;
    const router = await ethers.getContractAt(routerABI, UNISWAP_V3_ROUTER);
    const amountIn = ethers.parseEther("1");
    const params = [
      wethAddress,
      usdcAddress,
      500,
      userWallet.address,
      amountIn,
      0,
      0
    ]

    const tx = await router.exactInputSingle(params, { value: amountIn });
    await tx.wait();
  }

  before(async function () {
    const network = await ethers.provider.getNetwork();
    const chainId = Number(network.chainId);
    addressesPerChain = CONFIG.ADDRESSES_PER_CHAIN[chainId];
    wethAddress = addressesPerChain.TOKEN0_ADDRESS; // WETH
    usdcAddress = addressesPerChain.MAIN_TOKEN_ADDRESS; // USDC
    daiAddress = addressesPerChain.DAI_ADDRESS; // DAI
    wbtcAddress = addressesPerChain.BTC_ADDRESS; // BTC
    ethPriceFeed = addressesPerChain.ETH_PRICE_FEED;
    usdcPriceFeed = addressesPerChain.USDC_PRICE_FEED;
    wbtcPriceFeed = addressesPerChain.WBTC_PRICE_FEED;
    daiPriceFeed = addressesPerChain.DAI_PRICE_FEED;

    userManagerAddress = await getDeploymentAddress("UserManagerUpgradeable");
    vaultManagerAddress = await getDeploymentAddress("VaultManagerUpgradeable");
    liquidityManagerAddress = await getDeploymentAddress("LiquidityManagerUpgradeable");
    oracleSwapAddress = await getDeploymentAddress("OracleSwapUpgradeable");
    liquidityHelperAddress = await getDeploymentAddress("LiquidityHelperUpgradeable");
    aggregatorAddress = await getDeploymentAddress("AggregatorUpgradeable");

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

    let txLM = await userManagerGeneralAdmin.addLiquidityManagers([
      vaultManagerAddress,
      liquidityHelperAddress,
      liquidityManagerAddress,
      oracleSwapAddress,
    ]);

    const receiptLM = await txLM.wait(1);
    const eventTopicLM = ethers.id("LiquidityManagerAdded(address)");
    const eventLogsLM = receiptLM.logs.filter(log => log.topics[0] === eventTopicLM);
    console.log("LiquidityManagerAdded emitted:", eventLogsLM.length > 0);

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
    txVM = await userManagerGeneralAdmin.addVaultManagers([aggregatorAddress, vaultManagerAddress])

    const receiptVM = await txVM.wait(1);
    const eventTopicVM = ethers.id("VaultManagerAdded(address)");
    const eventLogsVM = receiptVM.logs.filter(log => log.topics[0] === eventTopicVM);
    console.log("VaultManagerAdded emitted:", eventLogsVM.length > 0);

    let isVaultManager = await userManagerUserManager.isVaultManager(
      aggregatorAddress
    );
    expect(isVaultManager).to.be.true;

    isVaultManager = await userManagerUserManager.isVaultManager(
      vaultManagerAddress
    );
    expect(isVaultManager).to.be.true;

    // Assign the user role to the userWallet
    var txUM = await userManagerUserManager.addUsers([userWallet.address])
    const receiptUM = await txUM.wait(1);
    const eventTopicUM = ethers.id("UserAdded(address)");
    const eventLogsUM = receiptUM.logs.filter(log => log.topics[0] === eventTopicUM);
    console.log("UserManagerAdded emitted:", eventLogsUM.length > 0);

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

    const tokens = [wethAddress, usdcAddress, daiAddress, wbtcAddress];
    const oracles = [ethPriceFeed, usdcPriceFeed, daiPriceFeed, wbtcPriceFeed];
    const txOracle = await OracleSwap.setTokenOracles(tokens, oracles);
    await txOracle.wait();
    console.log("Oracles set successfully:");
    console.log(
      `Token0: ${wethAddress} -> ${await OracleSwap.getTokenOracle(
        wethAddress
      )}`
    );
    console.log(
      `Token1: ${usdcAddress} -> ${await OracleSwap.getTokenOracle(
        usdcAddress
      )}`
    );
    console.log(
      `Token2: ${daiAddress} -> ${await OracleSwap.getTokenOracle(
        daiAddress
      )}`
    );
    console.log(
      `Token3: ${wbtcAddress} -> ${await OracleSwap.getTokenOracle(
        wbtcAddress
      )}`
    );
  });
});



