const { expect } = require("chai");
const { ethers } = require("hardhat");
require("dotenv").config();
const { getDeploymentAddress } = require("../../launch/DeploymentStore");

describe("I_Collect", function () {
  let provider, ownerWallet, userWallet;
  let VaultManager, LiquidityManager;
  let userManagerAddress, vaultManagerAddress, liquidityManagerAddress, aggregatorAddress;

  const poolId = "ui-232-122";
  before(async function () {
    userManagerAddress = await getDeploymentAddress("UserManagerUpgradeable");
    vaultManagerAddress = await getDeploymentAddress("VaultUpgradeable");
    liquidityManagerAddress = await getDeploymentAddress("LiquidityManagerUpgradeable");
    aggregatorAddress = await getDeploymentAddress("AggregatorUpgradeable");
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
    await userManager.addUser2FAs([marcWallet.address]);

    await userManager.set2FA(userWallet.address, valid2FACode);

    VaultManager = await ethers.getContractAt(
      "VaultManagerUpgradeable",
      vaultManagerAddress,
      ownerWallet
    );

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
