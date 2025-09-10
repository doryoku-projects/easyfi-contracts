const { ethers } = require("hardhat");
const { TickMath } = require('@uniswap/v3-sdk');
require("dotenv").config();

describe("Token Swap Test", function () {
  let userWallet;

  const token0Address = "0x82af49447d8a07e3bd95bd0d56f35241523fbab1";
  const token1Address = "0xaf88d065e77c8cC2239327C5EDb3A432268e5831";
  const aggregatorAddress = process.env.AGGREGATOR_ADDRESS;
  const swapRouterAddress = process.env.SWAP_ROUTER_ADDRESS;

  before(async function () {
    userWallet = new ethers.Wallet(
      process.env.USER_PRIVATE_KEY,
      ethers.provider
    );
  });

  it("should swap ETH for USDC using Uniswap V3 router", async function () {
    const amountIn = ethers.parseEther("100");
    const sqrtPriceLimit = TickMath.getSqrtRatioAtTick(-199005);

    const routerABI = [
      "function exactInputSingle((address,address,uint24,address,uint256,uint256,uint256,uint160)) payable returns (uint256 amountOut)"
    ];
    const router = await ethers.getContractAt(routerABI, swapRouterAddress);

    const params = [
      token0Address,
      token1Address,
      500,
      userWallet.address,
      Math.floor(Date.now() / 1000) + 60 * 10,
      amountIn,
      0,
      0
    ];

    console.log("Swapping ETH for USDC...");

    const tx = await router.connect(userWallet).exactInputSingle(params, { value: amountIn });
    const receipt = await tx.wait();

    console.log("Swap transaction completed in block:", receipt.blockNumber);
  });
});
