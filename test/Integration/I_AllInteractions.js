const { expect } = require("chai");
const { ethers } = require("hardhat");
require("dotenv").config();

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe("I_AllInteractions end-to-end (w/ Position Data)", function () {
  let ownerWallet, userWallet, marcWallet, pepWallet, testWallet;
  let Aggregator, VaultManager, UserManager, LiquidityManager, MainToken, WETH;
  const aggregatorAddress = process.env.AGGREGATOR_ADDRESS;
  const vaultManagerAddress = process.env.VAULT_MANAGER_ADDRESS;
  const userManagerAddress = process.env.USER_MANAGER_ADDRESS;
  const liquidityManagerAddr = process.env.LIQUIDITY_MANAGER_ADDRESS;
  const mainTokenAddress = process.env.MAIN_TOKEN_ADDRESS; // USDC
  const token0Address = "0x82af49447d8a07e3bd95bd0d56f35241523fbab1"; // WETH
  const poolId = "ui-232-122";
  const mintAmount = ethers.parseUnits("15", 6);
  const increaseAmount = ethers.parseUnits("10", 6);
  const initialUSDCFunding = ethers.parseUnits("10", 6);
  const ethFundingAmount = ethers.parseEther("0.5");
  const halfBP = 5000;
  const fullBP = 10000;
  const newTickLower = -198690;
  const newTickUpper = -196950;
  const twoFACode = "424242";

  async function fundWallet(to) {
    await MainToken.connect(userWallet).transfer(to, initialUSDCFunding);
    await userWallet.sendTransaction({ to, value: ethFundingAmount });
  }

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

    testWallet = ethers.Wallet.createRandom().connect(ethers.provider);

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
    UserManager = await ethers.getContractAt(
      "UserManagerUpgradeable",
      userManagerAddress,
      pepWallet
    );
    LiquidityManager = await ethers.getContractAt(
      "LiquidityManagerUpgradeable",
      liquidityManagerAddr,
      marcWallet
    );
    MainToken = await ethers.getContractAt(
      "IERC20",
      mainTokenAddress,
      userWallet
    );
    WETH = await ethers.getContractAt("IERC20", token0Address, userWallet);

    // ————— 1) Grant USER_ROLE to testWallet —————
    // await expect(UserManager.addUsers([userWallet.address]))
    //   .to.emit(UserManager, "UserAdded")
    //   .withArgs(userWallet.address);

    await expect(
      UserManager.connect(marcWallet).addLiquidityManagers([marcWallet.address])
    )
      .to.emit(UserManager, "LiquidityManagerAdded")
      .withArgs(marcWallet.address);
  });

  it("runs full flow with position-data logs", async function () {
    // ————— 2) Fund testWallet with USDC and ETH —————
    // console.log("Funding testWallet...");
    await fundWallet(testWallet.address);
    const balUSDC0 = await MainToken.balanceOf(userWallet.address);
    const balETH0 = await ethers.provider.getBalance(userWallet.address);
    console.log("  → userWallet USDC:", balUSDC0.toString());
    console.log("  → userWallet ETH :", ethers.formatEther(balETH0));

    await VaultManager.connect(marcWallet).setUserPackage(userWallet.address, 1);
    // ————— 3) Mint (10k) —————
    const isUser = await UserManager.isUser(userWallet.address);
    console.log("Is user:", isUser);
    console.log("Minting position (10k) via Aggregator...");
    await MainToken.connect(userWallet).approve(aggregatorAddress, mintAmount);
    const mintTx = await Aggregator.connect(
      userWallet
    ).mintPositionOrIncreaseLiquidity(
      poolId,
      1,
      token0Address,
      mainTokenAddress,
      500,
      -199000,
      -197000,
      mintAmount
    );
    await mintTx.wait();

    let info = await Aggregator.connect(marcWallet).getUserInfo(
      userWallet.address,
      poolId,
      1
    );
    console.log("  → post-mint userInfo:", info);
    expect(info.tokenId).to.not.equal(0);
    const tokenId = info.tokenId;

    let pos = await LiquidityManager.getPositionData(tokenId);
    console.log("Position Data after mint:", {
      liquidity: pos.liquidity.toString(),
      tokensOwed0: pos.tokensOwed0.toString(),
      tokensOwed1: pos.tokensOwed1.toString(),
    });

    // ————— 4) Increase (10k) —————
    console.log("Increasing liquidity (another 10k)...");
    await MainToken.connect(userWallet).approve(
      aggregatorAddress,
      increaseAmount
    );
    const incTx = await Aggregator.connect(
      userWallet
    ).mintPositionOrIncreaseLiquidity(
      poolId,
      1,
      token0Address,
      mainTokenAddress,
      500,
      -199000,
      -197000,
      increaseAmount
    );
    await incTx.wait();

    const infoInc = await Aggregator.connect(marcWallet).getUserInfo(
      userWallet.address,
      poolId,
      1
    );
    console.log("  → post-increase userInfo:", infoInc);

    pos = await LiquidityManager.getPositionData(tokenId);
    console.log("Position Data after increase:", {
      liquidity: pos.liquidity.toString(),
      tokensOwed0: pos.tokensOwed0.toString(),
      tokensOwed1: pos.tokensOwed1.toString(),
    });

    // ————— 5) Migrate position —————
    console.log(
      "Vault WETH balance before migrate:",
      (await WETH.balanceOf(vaultManagerAddress)).toString()
    );
    console.log(
      "Vault MainToken balance before migrate:",
      (await MainToken.balanceOf(vaultManagerAddress)).toString()
    );
    const beforeMigrate = await LiquidityManager.getPositionData(tokenId);
    console.log("Position Data before migrate (owed):", {
      tickLower: beforeMigrate.tickLower,
      tickUpper: beforeMigrate.tickUpper,
      liquidity: beforeMigrate.liquidity.toString(),
      tokensOwed0: beforeMigrate.tokensOwed0.toString(),
      tokensOwed1: beforeMigrate.tokensOwed1.toString(),
    });

    await Aggregator.connect(marcWallet).migratePositionBatches(
      [userWallet.address],
      marcWallet.address,
      poolId,
      [1],
      newTickLower,
      newTickUpper
    );

    //Get new user info
    info = await Aggregator.connect(marcWallet).getUserInfo(
      userWallet.address,
      poolId,
      1
    );

    console.log("  → post-migrate userInfo:", info);
    expect(info.tokenId.toString()).to.not.equal(tokenId.toString());

    const postTokenId = info.tokenId;

    pos = await LiquidityManager.getPositionData(postTokenId);
    console.log("Position Data after migrate:", {
      tickLower: pos.tickLower,
      tickUpper: pos.tickUpper,
      liquidity: pos.liquidity.toString(),
      tokensOwed0: pos.tokensOwed0.toString(),
      tokensOwed1: pos.tokensOwed1.toString(),
    });
    console.log(
      "Vault WETH balance after migrate:",
      (await WETH.balanceOf(vaultManagerAddress)).toString()
    );
    console.log(
      "Vault MainToken balance after migrate:",
      (await MainToken.balanceOf(vaultManagerAddress)).toString()
    );

    // ————— 6) Collect fees (2FA) —————

    // await sleep(10000);

    await UserManager.connect(marcWallet).addUser2FAs([marcWallet.address]);

    let block = await ethers.provider.getBlock("latest");
    let timestamp = block.timestamp + 300;
    console.log("Current block timestamp:", timestamp);

    let messageHash = ethers.solidityPackedKeccak256(
      ["address", "uint256", "uint256"],
      [userWallet.address, 0, timestamp]
    );
    let signature = await userWallet.signMessage(ethers.getBytes(messageHash));
    await UserManager.connect(marcWallet).set2FA(
      userWallet.address,
      twoFACode,
      timestamp,
      0,
      signature
    );

    await Aggregator.connect(userWallet).collectFeesFromPosition(
      poolId,
      1,
      twoFACode
    );

    console.log("Collected fees from position");

    pos = await LiquidityManager.getPositionData(postTokenId);
    console.log("Position Data after collect should be 0:", {
      tokensOwed0: pos.tokensOwed0.toString(),
      tokensOwed1: pos.tokensOwed1.toString(),
    });

    block = await ethers.provider.getBlock("latest");
    timestamp = block.timestamp + 300;
    console.log("Current block timestamp:", timestamp);

    messageHash = ethers.solidityPackedKeccak256(
      ["address", "uint256", "uint256"],
      [userWallet.address, halfBP, timestamp]
    );
    signature = await userWallet.signMessage(ethers.getBytes(messageHash));

    await UserManager.connect(marcWallet).set2FA(
      userWallet.address,
      twoFACode,
      timestamp,
      halfBP,
      signature
    );

    // WITHDRAW 50%
    await Aggregator.connect(userWallet).decreaseLiquidityFromPosition(
      poolId,
      1,
      halfBP,
      twoFACode
    );
    pos = await LiquidityManager.getPositionData(postTokenId);
    console.log("Position Data after 50% withdraw:", {
      liquidity: pos.liquidity.toString(),
      tokensOwed0: pos.tokensOwed0.toString(),
    });

    const userInfoHalfWithdraw = await Aggregator.connect(
      marcWallet
    ).getUserInfo(userWallet.address, poolId, 1);

    console.log("USER INFO after 50% withdraw:", userInfoHalfWithdraw);

    await VaultManager.connect(marcWallet).setUserPackage(userWallet.address, 2);

    // await sleep(10000);

    block = await ethers.provider.getBlock("latest");
    timestamp = block.timestamp + 300;
    console.log("Current block timestamp:", timestamp);

    messageHash = ethers.solidityPackedKeccak256(
      ["address", "uint256", "uint256"],
      [userWallet.address, fullBP, timestamp]
    );
    signature = await userWallet.signMessage(ethers.getBytes(messageHash));

    await UserManager.connect(marcWallet).set2FA(
      userWallet.address,
      "414141",
      timestamp,
      fullBP,
      signature
    );
    // WITHDRAW 100%
    await Aggregator.connect(userWallet).decreaseLiquidityFromPosition(
      poolId,
      1,
      fullBP,
      "414141"
    );

    const userInfoFullWithdraw = await Aggregator.connect(
      marcWallet
    ).getUserInfo(userWallet.address, poolId, 1);

    console.log("USER INFO after 100% withdraw:", userInfoFullWithdraw);

    // FINAL BALANCE
    const finalBal = await MainToken.balanceOf(userWallet.address);
    console.log("Final USDC balance:", finalBal.toString());
  });
});
