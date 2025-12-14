const { expect } = require("chai");
const { ethers } = require("hardhat");
require("dotenv").config();
const { getDeploymentAddress } = require("../../launch/DeploymentStore");

describe("OracleSwapUpgradeable — TWAP Oracle Tests", function () {
    let owner, generalAdmin, liquidityManagerSigner;
    let oracleSwap, protocolConfig, uniswapFactory, OracleSwapHarness;
    let oracleSwapAddress, protocolConfigAddress, OracleSwapHarnessAddress;
    let mainToken, weth, usdc;
    
    // Arbitrum mainnet addresses
    const UNISWAP_V3_FACTORY = "0x1F98431c8aD98523631AE4a59f267346ea31F984";
    const WBTC_ADDRESS = "0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f";
    const USDC_ADDRESS = "0xaf88d065e77c8cC2239327C5EDb3A432268e5831";
    const USDC_WETH_POOL = "0xC31E54c7a869B9FcBEcc14363CF510d1c41fa443"; // 0.05% fee pool
    
    const FEE_TIER_LOW = 500;    // 0.03%
    // const FEE_TIER_MEDIUM = 3000; // 0.3%
    // const FEE_TIER_HIGH = 10000;  // 1%
    
    const TWAP_WINDOW = 600; // 10 minutes
    const MIN_TWAP_WINDOW = 60;
    const MAX_TWAP_WINDOW = 86400;

    before(async function () {
        // --- Setup signers
        owner = new ethers.Wallet(process.env.MASTER_ADMIN_PRIVATE_KEY, ethers.provider);
        generalAdmin = new ethers.Wallet(process.env.GENERAL_ADMIN_PRIVATE_KEY, ethers.provider);
        
        const liquidityManagerAddr = await getDeploymentAddress("LiquidityManagerUpgradeable");
        await ethers.provider.send("hardhat_impersonateAccount", [liquidityManagerAddr]);
        liquidityManagerSigner = await ethers.getSigner(liquidityManagerAddr);
        // Fund the liquidity manager with some ETH for gas
        await ethers.provider.send("hardhat_setBalance", [liquidityManagerAddr, "0x1000000000000000000"]);

        // --- Get deployed addresses
        protocolConfigAddress = await getDeploymentAddress("ProtocolConfigUpgradeable");
        oracleSwapAddress = await getDeploymentAddress("OracleSwapUpgradeable");
        OracleSwapHarnessAddress = await getDeploymentAddress("OracleSwapHarness");

        // --- Attach contracts
        protocolConfig = await ethers.getContractAt("ProtocolConfigUpgradeable", protocolConfigAddress, generalAdmin);
        oracleSwap = await ethers.getContractAt("OracleSwapUpgradeable", oracleSwapAddress, generalAdmin);
        uniswapFactory = await ethers.getContractAt("IUniswapV3Factory", UNISWAP_V3_FACTORY);
        OracleSwapHarness = await ethers.getContractAt("OracleSwapHarness", OracleSwapHarnessAddress);
        
        // --- Get token contracts
        mainToken = await ethers.getContractAt("IERC20Metadata", await protocolConfig.getAddress(ethers.keccak256(ethers.toUtf8Bytes("MainToken"))));
        weth = await ethers.getContractAt("IERC20Metadata", WBTC_ADDRESS);
        usdc = await ethers.getContractAt("IERC20Metadata", USDC_ADDRESS);
    });

    after(async function () {
        const liquidityManagerAddr = await getDeploymentAddress("LiquidityManagerUpgradeable");
        await ethers.provider.send("hardhat_stopImpersonatingAccount", [liquidityManagerAddr]);
    });


    describe("Fetching TWAP Price", function() {

        it("get price", async function() {
            // ---- Inputs ----
            const tokenIn = WBTC_ADDRESS;
            const tokenOut = USDC_ADDRESS;
            const fee = 500; // IMPORTANT: 0.05% pool
            const amountIn = ethers.parseUnits("1", 8); // 1 WBTC (8 decimals)

            // ---- Fetch decimals ----
            const tokenInDecimals = await weth.decimals();
            const tokenOutDecimals = await usdc.decimals();

            // ---- Fetch TWAP prices ----
            const parsedAnswerIn =
            await OracleSwapHarness
                .connect(liquidityManagerSigner)
                .exposeGetTWAPPrice(tokenIn, tokenOut, fee, UNISWAP_V3_FACTORY);
            console.log("### ~ I_OracleSwapTWAPTest.js:117 ~ parsedAnswerIn:", parsedAnswerIn);

            const parsedAnswerOut =
            await OracleSwapHarness
                .connect(liquidityManagerSigner)
                .exposeGetTWAPPrice(tokenOut, tokenIn, fee, UNISWAP_V3_FACTORY);
            console.log("### ~ I_OracleSwapTWAPTest.js:123 ~ parsedAnswerOut:", parsedAnswerOut);

            // ---- Decimal difference ----
            let decimalsDifference;
            if (tokenInDecimals >= tokenOutDecimals) {
            decimalsDifference = tokenInDecimals - tokenOutDecimals;
            } else {
            decimalsDifference = tokenOutDecimals - tokenInDecimals;
            }

            // ---- Compute amountOut (exact Solidity translation) ----
            let computedAmountOut;
            let PRECISION_FACTOR = 10n ** 18n;

            if (tokenInDecimals >= tokenOutDecimals) {
            computedAmountOut =
                (parsedAnswerIn *
                amountIn *
                PRECISION_FACTOR) /
                (parsedAnswerOut *
                (10n ** BigInt(decimalsDifference)));

            computedAmountOut = computedAmountOut / PRECISION_FACTOR;
            } else {
            computedAmountOut =
                (parsedAnswerIn *
                amountIn *
                (10n ** BigInt(decimalsDifference)) *
                PRECISION_FACTOR) /
                parsedAnswerOut;

            computedAmountOut = computedAmountOut / PRECISION_FACTOR;
            }

            // ---- Slippage ----
            const slippageNumerator = await oracleSwap.s_slippageNumerator?.() // if public
            ?? 9900n; // fallback if not exposed

            const BP = await protocolConfig
            .connect(liquidityManagerSigner)
            .getUint(ethers.keccak256(ethers.toUtf8Bytes("BP")));

            const computedAmountOutMinimum =
            (computedAmountOut * slippageNumerator) / BP;

            // ---- Logs ----
            console.log("TWAP In  :", parsedAnswerIn.toString());
            console.log("TWAP Out :", parsedAnswerOut.toString());
            console.log("AmountOut:", computedAmountOut.toString());
            console.log("MinOut   :", computedAmountOutMinimum.toString());

        });
    });

});