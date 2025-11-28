const { expect } = require("chai");
const { ethers } = require("hardhat");
require("dotenv").config();
const { getDeploymentAddress } = require("../../launch/DeploymentStore");

describe("I_Collect", function () {
  let provider, ownerWallet, userWallet;
  let VaultManager, LiquidityManager;
  let userManagerAddress, vaultManagerAddress, liquidityManagerAddress, aggregatorAddress;

  // const vaultManagerAddress = process.env.VAULT_MANAGER_ADDRESS;
  // const liquidityManagerAddress = process.env.LIQUIDITY_MANAGER_ADDRESS;
  // const userManagerAddress = process.env.USER_MANAGER_ADDRESS;
  // const aggregatorAddress = process.env.AGGREGATOR_ADDRESS;
  const poolId = "ui-232-122";
  console.log("### ~ I_Collect.js:16 ~ poolId:", poolId);

  before(async function () {
    userManagerAddress = await getDeploymentAddress("UserManagerUpgradeable");
    console.log("### ~ I_Collect.js:20 ~ userManagerAddress:", userManagerAddress);
    vaultManagerAddress = await getDeploymentAddress("VaultManagerUpgradeable");
    liquidityManagerAddress = await getDeploymentAddress("LiquidityManagerUpgradeable");
    aggregatorAddress = await getDeploymentAddress("AggregatorUpgradeable");
    console.log("### ~ I_Collect.js:23 ~ aggregatorAddress:", aggregatorAddress);

    ownerWallet = new ethers.Wallet(
      process.env.MASTER_ADMIN_PRIVATE_KEY,
      ethers.provider
    );
    userWallet = new ethers.Wallet(
      process.env.USER_PRIVATE_KEY,
      ethers.provider
    );
    marcWallet = new ethers.Wallet(
      process.env.GENERAL_ADMIN_PRIVATE_KEY,
      ethers.provider
    );

    randomWallet = ethers.Wallet.createRandom().connect(ethers.provider);
    console.log("### ~ I_Collect.js:39 ~ randomWallet:", randomWallet);

    userManager = await ethers.getContractAt(
      "UserManagerUpgradeable",
      userManagerAddress,
      marcWallet
    );

    // await expect(
    //   userManager.addLiquidityManagers([
    //     randomWallet.address,
    //   ])
    // ).to.emit(userManager, "LiquidityManagerAdded");



    const valid2FACode = "123456";
    console.log("### ~ I_Collect.js:56 ~ valid2FACode:", valid2FACode);
    await userManager.addUser2FAs([marcWallet.address]);

    await userManager.set2FA(userWallet.address, valid2FACode);

    VaultManager = await ethers.getContractAt(
      "VaultManagerUpgradeable",
      vaultManagerAddress,
      ownerWallet
    );
    console.log("### ~ I_Collect.js:66 ~ VaultManager:", VaultManager);

    LiquidityManager = await ethers.getContractAt(
      "LiquidityManagerUpgradeable",
      liquidityManagerAddress,
      randomWallet
    );

    Aggregator = await ethers.getContractAt(
      "AggregatorUpgradeable",
      aggregatorAddress,
      userWallet
    );

    const userInfo = await Aggregator.connect(marcWallet).getUserInfo(
      userWallet.address, 
      poolId
    );
    console.log("### ~ I_Collect.js:84 ~ userInfo:", userInfo);
    expect(userInfo.tokenId).to.not.equal(
      0,
      "User must have a valid position for fees collection"
    );
  });

  describe("Fee collection", function () {
    it("Should FAIL collecting fees because of the wrong 2FA code", async function () {
      
      const userInfoBefore = await Aggregator.connect(marcWallet).getUserInfo(
        userWallet.address,
        poolId
      );
      const tokenId = userInfoBefore.tokenId;
      console.log ("Token ID:", tokenId);
      const code2FA = "111111";

      const positionBefore = await LiquidityManager.getPositionData(tokenId);

      console.log("Position before fee collection:", positionBefore);

      const tx = await expect(
        Aggregator.collectFeesFromPosition(poolId, code2FA)
      ).to.be.revertedWithCustomError(userManager, "UM_INVALID_2FA_CODE");
    });

    it.only("Should collect fees and update the position data", async function () {
      
      const userInfoBefore = await Aggregator.connect(marcWallet).getUserInfo(
        userWallet.address,
        poolId
      );
      const tokenId = userInfoBefore.tokenId;
      console.log ("Token ID:", tokenId);
      const code2FA = "123456"; // Correct 2FA code

      // const positionBefore = await LiquidityManager.getPositionData(tokenId);

      // console.log("Position before fee collection:", positionBefore);

      
      const tx = await Aggregator.collectFeesFromPosition(poolId, code2FA)
      await tx.wait();

      // const positionAfter = await LiquidityManager.getPositionData(tokenId);

      // console.log("Position after fee collection:", positionAfter);


      // const mainToken = await ethers.getContractAt("IERC20", process.env.MAIN_TOKEN_ADDRESS, ownerWallet);
      // const mainTokenBalance = await mainToken.balanceOf(vaultManagerAddress);

      // const companyFees = await VaultManager.getCompanyFees();
      // console.log("COMPANY FEES ", companyFees.toString());
      // console.log("BALANCE CONTRACTO ", mainTokenBalance.toString());
    });
  });

  describe("Revert conditions for fee collection", function () {
    it("Should revert when collecting fees if the user has no position", async function () {
      // const tempWallet = ethers.Wallet.createRandom().connect(provider);
      const code2FA = "123456"; // Correct 2FA code
      await expect(
        Aggregator.connect(marcWallet).collectFeesFromPosition(poolId, code2FA)
      ).to.be.revertedWithCustomError(VaultManager,"VM_NO_POSITION");
    });
  });
});
