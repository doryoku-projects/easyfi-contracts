const { expect } = require("chai");
const { ethers } = require("hardhat");
require("dotenv").config();

describe("I_MigrateBatches via Aggregator", function () {
  let ownerWallet, userWallet, marcWallet, pepWallet;
  let testWallets = [];

  let Aggregator, UserManager, MainToken;

  const aggregatorAddress = process.env.AGGREGATOR_ADDRESS;
  const userManagerAddress = process.env.USER_MANAGER_ADDRESS;
  const mainTokenAddress = process.env.MAIN_TOKEN_ADDRESS; // e.g. USDC
  const token0Address = "0x82af49447d8a07e3bd95bd0d56f35241523fbab1"; // WETH
  // const poolId = 1;
  const amountUSDCDesired = ethers.parseUnits("10000", 6);
  const ethFundingAmount = ethers.parseEther("0.5"); // 0.5 ETH for gas
  const newTickLower = -198280;
  const newTickUpper = -196960;
  const poolId = "ui-232-122";

  async function fundWallet(toAddress) {
    await MainToken.connect(userWallet).transfer(toAddress, amountUSDCDesired);

    await userWallet.sendTransaction({
      to: toAddress,
      value: ethFundingAmount,
    });
  }

  before(async function () {
    ownerWallet = new ethers.Wallet(
      process.env.OWNER_PRIVATE_KEY,
      ethers.provider
    );
    userWallet = new ethers.Wallet(
      process.env.USER_PRIVATE_KEY,
      ethers.provider
    );
    marcWallet = new ethers.Wallet(
      process.env.MARC_PRIVATE_KEY,
      ethers.provider
    );
    pepWallet = new ethers.Wallet(
      process.env.PEP_OWNER_PRIVATE_KEY,
      ethers.provider
    );

    Aggregator = await ethers.getContractAt(
      "AggregatorUpgradeable",
      aggregatorAddress,
      pepWallet
    );
    UserManager = await ethers.getContractAt(
      "UserManagerUpgradeable",
      userManagerAddress,
      pepWallet
    );
    MainToken = await ethers.getContractAt(
      "IERC20",
      mainTokenAddress,
      userWallet
    );

    // for (let i = 0; i < 4; i++) {
    //   const w = ethers.Wallet.createRandom().connect(ethers.provider);
    //   testWallets.push(w);
    // }
  });

  it("should migrate just 1 positions into new tick range", async function () {
    const addresses = [userWallet.address];

    const balanceBefore = await MainToken.balanceOf(marcWallet.address);
    console.log("Balance before migration:", balanceBefore.toString());

    const infoBefore = await Aggregator.connect(marcWallet).getUserInfo(
      userWallet.address,
      poolId
    );

    console.log("User info before migration:", infoBefore);


    await expect(
      Aggregator.connect(marcWallet).migratePositionBatches(
        addresses,
        marcWallet.address,
        poolId,
        newTickLower,
        newTickUpper
      )
    ).to.not.be.reverted;

    const balanceAfter = await MainToken.balanceOf(marcWallet.address);
    console.log("Balance after migration:", balanceAfter.toString());

    const InfoAfter = await Aggregator.connect(marcWallet).getUserInfo(
      userWallet.address,
      poolId
    );
    console.log("User info after migration:", InfoAfter);

    // for (const w of testWallets) {
    //   const infoAfter = await Aggregator.connect(marcWallet).getUserInfo(
    //     w.address,
    //     poolId
    //   );
    //   expect(infoAfter.tickLower).to.equal(newTickLower);
    //   expect(infoAfter.tickUpper).to.equal(newTickUpper);
    //   console.log("User info after migration:", infoAfter);
    // }
  });



  // it("should grant USER_ROLE to each of the 5 new wallets", async function () {
  //   const addresses = testWallets.map((w) => w.address);
  //   await expect(UserManager.addUsers(addresses)).to.emit(
  //     UserManager,
  //     "UserAdded"
  //   );
  // });

  // it("should fund each wallet then mint via Aggregator", async function () {
  //   for (const w of testWallets) {
  //     await fundWallet(w.address);

  //     const tokenAsUser = MainToken.connect(w);
  //     await tokenAsUser.approve(aggregatorAddress, amountUSDCDesired);

  //     await expect(
  //       Aggregator.connect(w).mintPositionOrIncreaseLiquidity(
  //         poolId,
  //         token0Address,
  //         mainTokenAddress,
  //         500,
  //         -198650,
  //         -196980,
  //         amountUSDCDesired
  //       )
  //     ).to.not.be.reverted;

  //     const info = await Aggregator.connect(marcWallet).getUserInfo(
  //       w.address,
  //       poolId
  //     );
  //     expect(info.tokenId).to.not.equal(0);
  //   }
  // });

  // it("should batch-migrate all 4 positions into new tick range", async function () {
  //   const addresses = testWallets.map((w) => w.address);

  //   await expect(
  //     Aggregator.connect(marcWallet).migratePositionBatches(
  //       addresses,
  //       marcWallet.address,
  //       poolId,
  //       newTickLower,
  //       newTickUpper
  //     )
  //   ).to.not.be.reverted;

  //   for (const w of testWallets) {
  //     const infoAfter = await Aggregator.connect(marcWallet).getUserInfo(
  //       w.address,
  //       poolId
  //     );
  //     expect(infoAfter.tickLower).to.equal(newTickLower);
  //     expect(infoAfter.tickUpper).to.equal(newTickUpper);
  //     console.log("User info after migration:", infoAfter);
  //   }
  // });

  // it("should revert when tickLower >= tickUpper", async function () {
  //   await expect(
  //     Aggregator.connect(marcWallet).migratePositionBatches(
  //       [testWallets[0].address],
  //       marcWallet.address,
  //       poolId,
  //       newTickUpper,
  //       newTickLower
  //     )
  //   ).to.be.revertedWithCustomError(Aggregator, "AGG_INVALID_TICK_RANGE");
  // });
});
