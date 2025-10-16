const { expect } = require("chai");
const { ethers } = require("hardhat");
require("dotenv").config();

describe("I_Decrease", function () {
  let ownerWallet, userWallet, marcWallet;
  let vaultManagerAddress, userManagerAddress, aggregatorAddress
  let Aggregator, VaultManager, userManager;

  const poolId = "ui-232-122";
  const halfLiquidity = 5000;
  const valid2FACode = "123456";

  before(async function () {

    userManagerAddress = await getDeploymentAddress("UserManagerUpgradeable");
    vaultManagerAddress = await getDeploymentAddress("VaultUpgradeable");
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

    Aggregator = await ethers.getContractAt(
      "AggregatorUpgradeable",
      aggregatorAddress,
      userWallet
    );
    VaultManager = await ethers.getContractAt(
      "VaultManagerUpgradeable",
      vaultManagerAddress,
      ownerWallet
    );
    userManager = await ethers.getContractAt(
      "UserManagerUpgradeable",
      userManagerAddress,
      marcWallet
    );

    // await userManager.addUser2FAs([marcWallet.address]);

    await userManager.set2FA(userWallet.address, valid2FACode);
  });

  it("Should decrease liquidity by 50% successfully when the correct 2FA code is provided", async function () {
    const tx = await Aggregator.decreaseLiquidityFromPosition(
      poolId,
      halfLiquidity,
      valid2FACode
    );
    await tx.wait();

    const userInfo = await Aggregator.connect(marcWallet).getUserInfo(
      userWallet.address,
      poolId
    );
    console.log(
      "Updated user info after 50% decrease with valid 2FA:",
      userInfo
    );
  });

  // it("Should FAIL decreasing liquidity by 50% because of the wrong 2FA code", async function () {
  //   const invalid2FACode = "111111";
  //   await expect(
  //     Aggregator.decreaseLiquidityFromPosition(
  //       poolId,
  //       halfLiquidity,
  //       invalid2FACode
  //     )
  //   ).to.be.revertedWithCustomError(userManager, "UM_INVALID_2FA_CODE");
  // });

  // it("Should FAIL decreasing liquidity by 50% because of the wrong poolId", async function () {
  //   const invalidPoolId = "99999999999999";
  //   await expect(
  //     Aggregator.decreaseLiquidityFromPosition(
  //       invalidPoolId,
  //       halfLiquidity,
  //       valid2FACode
  //     )
  //   ).to.be.revertedWithCustomError(VaultManager, "VM_NO_POSITION");
  // });

  // it("Should FAIL decreasing liquidity by 50% because of the wrong user", async function () {
  //   const invalidUserWallet = ethers.Wallet.createRandom().connect(
  //     ethers.provider
  //   );
  //   await expect(
  //     Aggregator.connect(invalidUserWallet).decreaseLiquidityFromPosition(
  //       poolId,
  //       halfLiquidity,
  //       valid2FACode
  //     )
  //   ).to.be.revertedWithCustomError(Aggregator, "UAC_NOT_USER");
  // });

  it("Should remove 100% of liquidity successfully when the correct 2FA code is provided", async function () {
    const tx = await Aggregator.decreaseLiquidityFromPosition(
      poolId,
      10000,
      valid2FACode
    );
    await tx.wait();

    const userInfo = await Aggregator.connect(marcWallet).getUserInfo(
      userWallet.address,
      poolId
    );
    console.log(
      "Updated user info after 100% decrease with valid 2FA:",
      userInfo
    );
  });
});
