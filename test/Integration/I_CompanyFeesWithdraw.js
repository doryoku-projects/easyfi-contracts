const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("I_CompanyFeesWithdraw", function () {
    let provider, ownerWallet, userWallet;
    let VaultManager, LiquidityManager;
    const vaultManagerAddress = process.env.VAULT_MANAGER_ADDRESS;
    const liquidityManagerAddress = process.env.LIQUIDITY_MANAGER_ADDRESS;
    const userManagerAddress = process.env.USER_MANAGER_ADDRESS;
    const aggregatorAddress = process.env.AGGREGATOR_ADDRESS;
    const poolId = 1;
    const valid2FACode = "123456";

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

        
        // await userManager.addUser2FAs([marcWallet.address]);
    
        await userManager.set2FA(ownerWallet.address, valid2FACode);
      



    });

    it("should withdraw company fees in two steps: 50% then 100% of the remaining", async function () {
        VaultManager = await ethers.getContractAt(
            "VaultManagerUpgradeable",
            vaultManagerAddress,
            ownerWallet
          );
        
        const mainToken = await ethers.getContractAt("IERC20", process.env.MAIN_TOKEN_ADDRESS, ownerWallet);


        // Check initial fees balance of the contract
        const initialBalance = await mainToken.balanceOf(vaultManagerAddress);
        console.log("Initial contract balance:",initialBalance.toString());

        // First withdrawal: withdraw 50% of the available fees
        const tx1 = await VaultManager.withdrawCompanyFees(5000, valid2FACode);
        await tx1.wait();

        // The contract fees should decrease approximately by 50%
        const balanceAfterFirstWithdraw = await mainToken.balanceOf(vaultManagerAddress);
        console.log("Contract balance after first withdraw:",balanceAfterFirstWithdraw.toString());
        expect(balanceAfterFirstWithdraw).to.be.lt(initialBalance);

        // Second withdrawal: withdraw 100% of the remaining fees
        const tx2 = await VaultManager.withdrawCompanyFees(10000, valid2FACode);
        await tx2.wait();

        // After withdrawing the remaining fees, the contract balance should be near zero
        const finalBalance = await mainToken.balanceOf(vaultManagerAddress);
        console.log("Final contract balance:",finalBalance.toString());
        expect(finalBalance).to.be.equal(0);
    });

    it("should revert if a non-master admin tries to withdraw fees", async function () {
        await expect(
            VaultManager.connect(userWallet).withdrawCompanyFees(5000, valid2FACode)
        ).to.be.reverted;
    });
});