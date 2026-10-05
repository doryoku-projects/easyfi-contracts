const { expect } = require("chai");
const { ethers } = require("hardhat");
require("dotenv").config();

// Live-network integration tests for the per-user hedge opt-in functions on
// AggregatorUpgradeable (mintPositionOrIncreaseLiquidityWithHedge, depositHedgeCollateral).
// Requires the upgraded Aggregator implementation to already be deployed at
// AGGREGATOR_ADDRESS, and HEDGE_TREASURY_ADDRESS to be set in .env before running.
describe("Aggregator Hedge Opt-In Tests", function () {
  let ownerWallet, userWallet, marcWallet;
  let Aggregator, ProtocolConfig, MainToken;
  let treasuryBalanceBefore;

  const protocolConfigAddress = process.env.PROTOCOL_CONFIG_ADDRESS;
  const aggregatorAddress = process.env.AGGREGATOR_ADDRESS;
  const maintokenAddress = process.env.MAIN_TOKEN_ADDRESS;
  const hedgeTreasuryAddress = process.env.HEDGE_TREASURY_ADDRESS;

  const HEDGE_TREASURY_KEY = ethers.keccak256(ethers.toUtf8Bytes("HedgeTreasury"));

  const token0Address = "0x82af49447d8a07e3bd95bd0d56f35241523fbab1";
  const token1Address = maintokenAddress;
  const fee = 500;
  const poolId = "ui-hedge-optin";
  const tickLower = -202000;
  const tickUpper = -200000;
  const amountUSDCDesired = ethers.parseUnits("10000", 6);
  const hedgeCollateralAmount = ethers.parseUnits("1000", 6);

  before(async function () {
    ownerWallet = new ethers.Wallet(process.env.MASTER_ADMIN_PRIVATE_KEY, ethers.provider);
    userWallet = new ethers.Wallet(process.env.USER_PRIVATE_KEY, ethers.provider);
    marcWallet = new ethers.Wallet(process.env.GENERAL_ADMIN_PRIVATE_KEY, ethers.provider);

    Aggregator = await ethers.getContractAt("AggregatorUpgradeable", aggregatorAddress, userWallet);
    ProtocolConfig = await ethers.getContractAt("ProtocolConfigUpgradeable", protocolConfigAddress, ownerWallet);
    MainToken = await ethers.getContractAt("IERC20", maintokenAddress, userWallet);

    const tx = await ProtocolConfig.setAddress(HEDGE_TREASURY_KEY, hedgeTreasuryAddress);
    await tx.wait();

    treasuryBalanceBefore = await MainToken.balanceOf(hedgeTreasuryAddress);
  });

  describe("mintPositionOrIncreaseLiquidityWithHedge", function () {
    it("mints the position and routes hedge collateral to the treasury in one transaction", async function () {
      await MainToken.connect(userWallet).approve(
        aggregatorAddress,
        amountUSDCDesired + hedgeCollateralAmount
      );

      const tx = await Aggregator.mintPositionOrIncreaseLiquidityWithHedge(
        poolId,
        token0Address,
        token1Address,
        fee,
        tickLower,
        tickUpper,
        amountUSDCDesired,
        hedgeCollateralAmount
      );
      const receipt = await tx.wait();

      const event = receipt.logs
        .map((log) => {
          try {
            return Aggregator.interface.parseLog(log);
          } catch {
            return null;
          }
        })
        .find((parsed) => parsed && parsed.name === "HedgeCollateralReceived");

      expect(event).to.not.be.undefined;
      expect(event.args.user).to.equal(userWallet.address);
      expect(event.args.poolId).to.equal(poolId);
      expect(event.args.tokenId).to.not.equal(0n);
      expect(event.args.hedgeCollateralAmount).to.equal(hedgeCollateralAmount);

      const userInfo = await Aggregator.connect(marcWallet).getUserInfo(userWallet.address, poolId);
      expect(userInfo.tokenId).to.equal(event.args.tokenId);

      const treasuryBalanceAfter = await MainToken.balanceOf(hedgeTreasuryAddress);
      expect(treasuryBalanceAfter - treasuryBalanceBefore).to.equal(hedgeCollateralAmount);
    });

    it("reverts if hedgeCollateralAmount is zero", async function () {
      await MainToken.connect(userWallet).approve(aggregatorAddress, amountUSDCDesired);

      await expect(
        Aggregator.mintPositionOrIncreaseLiquidityWithHedge(
          poolId,
          token0Address,
          token1Address,
          fee,
          tickLower,
          tickUpper,
          amountUSDCDesired,
          0
        )
      ).to.be.revertedWithCustomError(Aggregator, "AGG_ZERO_AMOUNT");
    });
  });

  describe("depositHedgeCollateral", function () {
    it("routes collateral to the treasury without touching the existing LP position", async function () {
      const userInfoBefore = await Aggregator.connect(marcWallet).getUserInfo(userWallet.address, poolId);
      const treasuryBalanceBeforeDeposit = await MainToken.balanceOf(hedgeTreasuryAddress);

      await MainToken.connect(userWallet).approve(aggregatorAddress, hedgeCollateralAmount);

      const tx = await Aggregator.depositHedgeCollateral(poolId, hedgeCollateralAmount);
      const receipt = await tx.wait();

      const event = receipt.logs
        .map((log) => {
          try {
            return Aggregator.interface.parseLog(log);
          } catch {
            return null;
          }
        })
        .find((parsed) => parsed && parsed.name === "HedgeCollateralReceived");

      expect(event.args.tokenId).to.equal(0n);
      expect(event.args.hedgeCollateralAmount).to.equal(hedgeCollateralAmount);

      const userInfoAfter = await Aggregator.connect(marcWallet).getUserInfo(userWallet.address, poolId);
      expect(userInfoAfter.tokenId).to.equal(userInfoBefore.tokenId);

      const treasuryBalanceAfterDeposit = await MainToken.balanceOf(hedgeTreasuryAddress);
      expect(treasuryBalanceAfterDeposit - treasuryBalanceBeforeDeposit).to.equal(hedgeCollateralAmount);
    });

    it("reverts if hedgeCollateralAmount is zero", async function () {
      await expect(
        Aggregator.depositHedgeCollateral(poolId, 0)
      ).to.be.revertedWithCustomError(Aggregator, "AGG_ZERO_AMOUNT");
    });
  });

  describe("HedgeTreasury not configured", function () {
    const ZERO_KEY_POOL = "ui-hedge-optin-no-treasury";

    beforeEach(async function () {
      await (await ProtocolConfig.setAddress(HEDGE_TREASURY_KEY, ethers.ZeroAddress)).wait();
    });

    afterEach(async function () {
      await (await ProtocolConfig.setAddress(HEDGE_TREASURY_KEY, hedgeTreasuryAddress)).wait();
    });

    it("depositHedgeCollateral reverts AGG_ZERO_ADDRESS when the treasury key is unset", async function () {
      await MainToken.connect(userWallet).approve(aggregatorAddress, hedgeCollateralAmount);

      await expect(
        Aggregator.depositHedgeCollateral(ZERO_KEY_POOL, hedgeCollateralAmount)
      ).to.be.revertedWithCustomError(Aggregator, "AGG_ZERO_ADDRESS");
    });
  });

  describe("Regression: mintPositionOrIncreaseLiquidity unaffected by the refactor", function () {
    it("still mints/increases liquidity exactly as before, with no hedge collateral pulled", async function () {
      const treasuryBalanceBeforeRegression = await MainToken.balanceOf(hedgeTreasuryAddress);

      await MainToken.connect(userWallet).approve(aggregatorAddress, amountUSDCDesired);

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

      const treasuryBalanceAfterRegression = await MainToken.balanceOf(hedgeTreasuryAddress);
      expect(treasuryBalanceAfterRegression).to.equal(treasuryBalanceBeforeRegression);
    });
  });
});

// NOTE: reentrancy-under-a-malicious-token and UUPS upgrade-safety (fork the current
// implementation, upgrade, diff storage) both need a local mainnet-fork/fixture harness.
// This repo's existing suite (test/Integration/*) only exercises already-deployed contracts
// on a live network, so those two checks from plan §1.6 aren't covered here — flagging so
// they aren't mistaken for "done".
