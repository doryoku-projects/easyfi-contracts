const { expect, use } = require("chai");
const { ethers } = require("hardhat");
const { TickMath } = require('@uniswap/v3-sdk');
describe("I_CompanyFeesWithdraw", function () {
    let ownerWallet, userWallet;
    let VaultManager;
    const vaultManagerAddress = process.env.VAULT_MANAGER_ADDRESS;
    const userManagerAddress = process.env.USER_MANAGER_ADDRESS;
    const aggregatorAddress = process.env.AGGREGATOR_ADDRESS;
    const valid2FACode = "123456";
    const token0Address = "0x82af49447d8a07e3bd95bd0d56f35241523fbab1"; // e.g. WETH
    const token1Address = "0xaf88d065e77c8cC2239327C5EDb3A432268e5831"; // e.g. USDC
    const ClientAddress = process.env.CLIENT_ADDRESS;

    before(async function () {
        // Get signers: assume the first is the master admin
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

        userManager = await ethers.getContractAt(
            "UserManagerUpgradeable",
            userManagerAddress,
            marcWallet
          );

        
    await userManager.addUser2FAs([ownerWallet.address]);// need to comment out when executing first time after deployment
    await userManager.addUser2FAs([userWallet.address]); //need to comment out when executing first time after deployment


    // doing this signature for withdrawal of company fees

    let block = await ethers.provider.getBlock("latest");
    let timestamp = block.timestamp + 2600;
    console.log("Current block timestamp:", timestamp);

    let messageHash = ethers.solidityPackedKeccak256(
      ["address", "uint256", "uint256"],
      [ownerWallet.address,3000, timestamp]
    );
    let signature = await ownerWallet.signMessage(ethers.getBytes(messageHash));
      await userManager.connect(ownerWallet).set2FA(
      ownerWallet.address,
      valid2FACode ,
      timestamp,
      3000,
      signature);
      



    });

   
    it("should withdraw company fees in certain percentage and send remaining to client", async function () {
          VaultManager = await ethers.getContractAt(
            "VaultManagerUpgradeable",
            vaultManagerAddress,
            ownerWallet
          );
        let aggregator = await ethers.getContractAt(
          "AggregatorUpgradeable",
          aggregatorAddress,
          ownerWallet
        );
        const mainToken = await ethers.getContractAt("IERC20", process.env.MAIN_TOKEN_ADDRESS, ownerWallet);


        // Check initial fees balance of the contract
        const initialBalance = await mainToken.balanceOf(vaultManagerAddress);
        console.log("Initial contract balance:",initialBalance.toString());
        const companyBalance = await VaultManager.getCompanyFees();
        console.log("Initial company fees balance:", companyBalance.toString());

        // Check initial balances of client and company
        const clientBalance = await mainToken.balanceOf(ClientAddress);
        console.log("Client balance before withdrawal:", clientBalance.toString());
        const ownerBalance = await mainToken.balanceOf(ownerWallet.address);
        console.log("Company balance before withdrawal:", ownerBalance.toString());

        //adding liquidity to the pool
      const poolId = "ui-232-122";
      const mintAmount = ethers.parseUnits("2000", 6);
      await mainToken.connect(userWallet).approve(aggregatorAddress, mintAmount);
      
      const mintTx = await aggregator.connect(
      userWallet
    ).mintPositionOrIncreaseLiquidity(
      poolId,
      token0Address,
      token1Address,
      500,
      -194000, //-193840,
      -191500,//-191840,
      mintAmount
    );
   await mintTx.wait();

        //swapping 

        const routerABI = [
      "function exactInputSingle((address,address,uint24,address,uint256,uint256,uint256,uint160)) payable returns (uint256 amountOut)"
      ];
      console.log("balance before swapping:", await mainToken.balanceOf(userWallet.address));
      const UNISWAP_V3_ROUTER = process.env.SWAP_ROUTER_ADDRESS;
      const router = await ethers.getContractAt(routerABI, UNISWAP_V3_ROUTER);
      let amountIn = ethers.parseEther("3");
      const sqrtPriceLimit = TickMath.getSqrtRatioAtTick(-199005); // upper tick of your range
      console.log("sqrtPriceLimit:", sqrtPriceLimit);
      const params = [
      token0Address,
      token1Address,
      500,
      userWallet.address,
      Math.floor(Date.now() / 1000) + 60 * 10,
      amountIn,
      0,
      0  
    ]

    const tx = await router.exactInputSingle(params, { value: amountIn });
    await tx.wait();
  console.log("balance after swapping:", await mainToken.balanceOf(userWallet.address));


    //decreasing liquidity

     const fullBP = 10000;
     const decreaseLiqFACode = "123123";
     let block = await ethers.provider.getBlock("latest");
     let timestamp = block.timestamp + 300;
     console.log("Current block timestamp:", timestamp);

    let messageHash = ethers.solidityPackedKeccak256(
      ["address", "uint256", "uint256"],
      [userWallet.address,fullBP, timestamp]
    );
     let signature = await userWallet.signMessage(ethers.getBytes(messageHash));

      await userManager.connect(userWallet).set2FA(
      userWallet.address,
      decreaseLiqFACode,
      timestamp,
      fullBP,
      signature
    );
 console.log("balance before decreasing liquidity of user:", await mainToken.balanceOf(userWallet.address));
      let d_tx = await aggregator.connect(userWallet).decreaseLiquidityFromPosition(
      poolId,
      fullBP,
      decreaseLiqFACode
    );

    await d_tx.wait();

    console.log("balance after decreasing liquidity of user:", await mainToken.balanceOf(userWallet.address));
    console.log("balance of vault manager after decreasing liquidity:", await mainToken.balanceOf(vaultManagerAddress));
        
        //withdraw the fees (optional : try this test with comment this fuction for first time and then uncomment it for second time to see the clear difference in the company fees balance)
       const tx1 = await VaultManager.connect(ownerWallet).withdrawCompanyFees(valid2FACode);
       await tx1.wait();
        
         let newBalance = await mainToken.balanceOf(vaultManagerAddress);
        console.log("Contract balance after withdrawing:",newBalance.toString());

         const companyBalance_2 = await VaultManager.getCompanyFees();
         console.log("Initial company fees balance:", companyBalance_2.toString());

         // balance of client & company after withdrawal
         const clientBalanceAfter = await mainToken.balanceOf(ClientAddress);
         console.log("Client balance after withdrawal:", clientBalanceAfter.toString());
         const ownerBalanceAfter = await mainToken.balanceOf(ownerWallet.address);
         console.log("Company balance after withdrawal:", ownerBalanceAfter.toString());
        
      
    });
});

/**
 * 
 * 1) start hydra core
 * 2) start hydra child
 * 3) deploy all contracts  
 * 4) yuvaraj will helps
 * 5) run subgraph and put it into hydra child and track the transactions!.
 * 
 */
