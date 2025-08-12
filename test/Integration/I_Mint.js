const { expect } = require("chai");
const { ethers } = require("hardhat");
require("dotenv").config();

describe("Aggregator Minting and Role Restriction Tests", function () {
  let ownerWallet, userWallet, marcWallet, randomWallet, pepWallet;
  let VaultManager, Aggregator, LiquidityManager, UserManager, MainToken;

  const vaultManagerAddress = process.env.VAULT_MANAGER_ADDRESS;
  const liquidityManagerAddress = process.env.LIQUIDITY_MANAGER_ADDRESS;
  const aggregatorAddress = process.env.AGGREGATOR_ADDRESS;
  const userManagerAddress = process.env.USER_MANAGER_ADDRESS;

  if (process.env.NETWORK === "arbitrum") {
    const maintokenAddress = process.env.MAIN_TOKEN_ADDRESS_ARBITRUM;
    const token0Address = "0x82af49447d8a07e3bd95bd0d56f35241523fbab1";
  }
  else if (process.env.NETWORK === "base") {
    const maintokenAddress = process.env.MAIN_TOKEN_ADDRESS_BASE;
    const token0Address = "0x4200000000000000000000000000000000000006"; // WETH on Base
  }

  const token1Address = maintokenAddress;
  const fee = 500;
  const poolId = "ui-232-122";
  const tickLower = -202000;
  const tickUpper = -200000;
  const amountUSDCDesired = ethers.parseUnits("10000", 6);
  // const ethFundingAmount = ethers.parseEther("0.5");

  // async function fundWallet(to) {
  //   await MainToken.connect(userWallet).transfer(to, amountUSDCDesired);
  //   await userWallet.sendTransaction({ to, value: ethFundingAmount });
  // }

  before(async function () {
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
    pepWallet = new ethers.Wallet(
      process.env.USER_MANAGER_PRIVATE_KEY,
      ethers.provider
    );

    randomWallet = ethers.Wallet.createRandom().connect(ethers.provider);

    VaultManager = await ethers.getContractAt(
      "VaultManagerUpgradeable",
      vaultManagerAddress,
      userWallet
    );

    Aggregator = await ethers.getContractAt(
      "AggregatorUpgradeable",
      aggregatorAddress,
      userWallet
    );

    LiquidityManager = await ethers.getContractAt(
      "LiquidityManagerUpgradeable",
      liquidityManagerAddress,
      marcWallet
    );

    UserManager = await ethers.getContractAt(
      "UserManagerUpgradeable",
      userManagerAddress,
      pepWallet
    );

    MainToken = await ethers.getContractAt(
      "IERC20",
      maintokenAddress,
      userWallet
    );

    await expect(
      UserManager.connect(marcWallet).addLiquidityManagers([marcWallet.address])
    )
      .to.emit(UserManager, "LiquidityManagerAdded")
      .withArgs(marcWallet.address);
  });

  describe("Successful mint and increase", function () {
    it.only("Should mint a new position if user has no position", async function () {
      const mainToken = await ethers.getContractAt(
        "IERC20",
        maintokenAddress,
        userWallet
      );
      await mainToken
        .connect(userWallet)
        .approve(aggregatorAddress, amountUSDCDesired);

      const tx = await Aggregator.mintPositionOrIncreaseLiquidity(
        poolId,
        token0Address,
        token1Address,
        fee,
        tickLower,
        tickUpper,
        amountUSDCDesired
      );

      const receipt = await tx.wait();

      const tokenId = receipt.logs[receipt.logs.length - 1]
        ? receipt.logs[receipt.logs.length - 1].topics[1]
        : "unknown";
      const tokenIdDecimal = BigInt(tokenId).toString();
      console.log("Minted tokenId (decimal):", tokenIdDecimal);

      const userInfo = await Aggregator.connect(marcWallet).getUserInfo(
        userWallet.address,
        poolId
      );

      console.log("User Info:", userInfo);
      expect(userInfo.tokenId).to.not.equal(0);
    });

    it("Should increase liquidity if position already exists with same tick range", async function () {
      const userInfoBefore = await Aggregator.connect(marcWallet).getUserInfo(
        userWallet.address,
        poolId
      );
      const tokenId = userInfoBefore.tokenId;
      expect(tokenId).to.not.equal(0);

      const mainToken = await ethers.getContractAt(
        "IERC20",
        maintokenAddress,
        userWallet
      );
      await mainToken
        .connect(userWallet)
        .approve(Aggregator.getAddress(), amountUSDCDesired);

      let pos = await LiquidityManager.getPositionData(tokenId);
      console.log("Position Data before mint:", {
        liquidity: pos.liquidity.toString(),
        tokensOwed0: pos.tokensOwed0.toString(),
        tokensOwed1: pos.tokensOwed1.toString(),
      });

      const tx = await Aggregator.mintPositionOrIncreaseLiquidity(
        poolId,
        token0Address,
        token1Address,
        fee,
        tickLower,
        tickUpper,
        amountUSDCDesired
      );
      await tx.wait();

      const userInfoAfter = await Aggregator.connect(marcWallet).getUserInfo(
        userWallet.address,
        poolId
      );

      let pos2 = await LiquidityManager.getPositionData(tokenId);
      console.log("Position Data after mint:", {
        liquidity: pos2.liquidity.toString(),
        tokensOwed0: pos2.tokensOwed0.toString(),
        tokensOwed1: pos2.tokensOwed1.toString(),
      });

      console.log("User Info After:", userInfoAfter);
      expect(userInfoAfter.tokenId).to.equal(tokenId);
    });
  });

  describe("Revert Conditions and Role Restrictions", function () {
    it("Should revert if amountMainTokenDesired is zero", async function () {
      await expect(
        Aggregator.mintPositionOrIncreaseLiquidity(
          poolId,
          token0Address,
          token1Address,
          fee,
          tickLower,
          tickUpper,
          0
        )
      ).to.be.revertedWithCustomError(Aggregator, "AGG_ZERO_AMOUNT");
    });

    it("Should revert if user already has a position with different ticks", async function () {
      const userInfo = await Aggregator.connect(marcWallet).getUserInfo(
        userWallet.address,
        poolId
      );

      const mainToken = await ethers.getContractAt(
        "IERC20",
        maintokenAddress,
        userWallet
      );
      await mainToken
        .connect(userWallet)
        .approve(Aggregator.getAddress(), amountUSDCDesired);

      const originalTickLower = userInfo.tickLower;
      const originalTickUpper = userInfo.tickUpper;

      const differentTickLower = originalTickLower - BigInt(100);
      await expect(
        Aggregator.mintPositionOrIncreaseLiquidity(
          poolId,
          token0Address,
          token1Address,
          fee,
          differentTickLower,
          originalTickUpper,
          amountUSDCDesired
        )
      ).to.be.revertedWithCustomError(VaultManager, "VM_RANGE_MISMATCH");
    });

    // it("Should revert if a wallet without the 'user' role calls Aggregator", async function () {
    // await fundWallet(randomWallet.address);
    //   const mainToken = await ethers.getContractAt(
    //     "IERC20",
    //     maintokenAddress,
    //     randomWallet
    //   );
    //   await mainToken
    //     .connect(randomWallet)
    //     .approve(aggregatorAddress, amountUSDCDesired);

    //   await expect(
    //     Aggregator.connect(randomWallet).mintPositionOrIncreaseLiquidity(
    //       poolId,
    //       token0Address,
    //       token1Address,
    //       fee,
    //       tickLower,
    //       tickUpper,
    //       amountUSDCDesired
    //     )
    //   ).to.be.reverted;
    // });
  });
});
