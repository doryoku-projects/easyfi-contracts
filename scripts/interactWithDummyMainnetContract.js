const { ethers } = require("hardhat");

async function interact(){
            let aggregatorAddress = process.env.AGGREGATOR_ADDRESS;
            let vaultManagerAddress = process.env.VAULT_MANAGER_ADDRESS;
            const token0Address = "0x82af49447d8a07e3bd95bd0d56f35241523fbab1"; // e.g. WETH
            const token1Address = "0xaf88d065e77c8cC2239327C5EDb3A432268e5831"; // e.g. USDC
            let ownerWallet = new ethers.Wallet(
                process.env.MASTER_ADMIN_PRIVATE_KEY,
                ethers.provider
              );
            let userWallet = new ethers.Wallet(
                          process.env.USER_PRIVATE_KEY,
                          ethers.provider
                        );
            const mainToken = await ethers.getContractAt("IERC20", process.env.MAIN_TOKEN_ADDRESS, ownerWallet);


            let Aggregator = await ethers.getContractAt(
                "AggregatorUpgradeable",
                aggregatorAddress,
                ownerWallet
            );
          let VaultManager = await ethers.getContractAt(
            "VaultManagerUpgradeable",
            vaultManagerAddress,
            ownerWallet
          );

        let userManager = await ethers.getContractAt(
            "UserManagerUpgradeable",
            process.env.USER_MANAGER_ADDRESS,
            ownerWallet
          );

        let package =   {
            cap_limit: 1000000000,
            fee_limit: 5000000000,
            client_share: 50,
            user_share: 50,
            active: true
    }
     // await userManager.addUser2FAs([userWallet.address]);
        
        // let setPackage_tx = await VaultManager.connect(ownerWallet).setPackageCap(package.cap_limit, package.fee_limit, package.client_share)
        // await setPackage_tx.wait();
       //console.log("setPackage_tx", setPackage_tx);
      //   let userPackage =   {
      //       address: userWallet.address,
      //       package_id: 1,
      //       package_name: "spurge"
      //   }
      //  let setUserPackage_tx = await VaultManager.connect(ownerWallet).setUserPackage(userPackage.address, userPackage.package_id)
      //   await setUserPackage_tx.wait();
      //   console.log("setUserPackage_tx", setUserPackage_tx);
 
        //mint or add liquidity

        const poolId = "176fdc3c-8b9b-4a32-9ff8-bb41ecaa02bc";
        const mintAmount = ethers.parseUnits("2", 6);
        console.log(mintAmount)
    await mainToken.connect(userWallet).approve(aggregatorAddress, mintAmount);
              
        const mintTx = await Aggregator.connect(
              userWallet
            ).mintPositionOrIncreaseLiquidity(
              poolId,
              1, //package id
              token0Address,
              token1Address,
              500,
             -199000, // -193840,
             -197000,// -191840,
              mintAmount
            );
          let mintReceipt = await mintTx.wait();
          console.log("mintReceipt", mintReceipt);


}

interact();