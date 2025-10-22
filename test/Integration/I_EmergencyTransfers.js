const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("I_EmergencyTransfers", function () {
    let provider, ownerWallet, userWallet;
    let VaultManager, LiquidityManager;
    let vaultManagerAddress, userManagerAddress

    const valid2FACode = "123456";

    before(async function () {

      userManagerAddress = await getDeploymentAddress("UserManagerUpgradeable");
      vaultManagerAddress = await getDeploymentAddress("VaultUpgradeable");

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

    it("should transfer all ERC20 tokens from the Vault", async function () {
        VaultManager = await ethers.getContractAt(
            "VaultManagerUpgradeable",
            vaultManagerAddress,
            ownerWallet
          );
        
        const mainToken = await ethers.getContractAt("IERC20", process.env.MAIN_TOKEN_ADDRESS, ownerWallet);


        // Check initial fees balance of the contract
        const initialBalance = await mainToken.balanceOf(vaultManagerAddress);
        console.log("Initial contract balance:",initialBalance.toString());
        const initialBalance2 = await mainToken.balanceOf(marcWallet.address);
        console.log("Initial marcWallet balance:",initialBalance2.toString());

        const tokensToWithdraw = [process.env.MAIN_TOKEN_ADDRESS];
        // The contract ERC20 MainToken Balance should be sent to MarcWallet
        const tx1 = await VaultManager.emergencyERC20BatchWithdrawal(tokensToWithdraw, marcWallet.address);
        await tx1.wait();

        
        const balanceAfterFirstWithdraw = await mainToken.balanceOf(vaultManagerAddress);
        console.log("Contract balance after first withdraw:",balanceAfterFirstWithdraw.toString());
        expect(balanceAfterFirstWithdraw).to.be.equal(0);
        // The marcWallet balance should increase by the amount withdrawn
        const balanceAfterFirstWithdraw2 = await mainToken.balanceOf(marcWallet.address);
        console.log("marcWallet balance after first withdraw:",balanceAfterFirstWithdraw2.toString());

    });

    it.only("should transfer all ERC721 tokens from the Vault", async function () {
        VaultManager = await ethers.getContractAt(
            "VaultManagerUpgradeable",
            vaultManagerAddress,
            ownerWallet
          );
        
        const nftToken = await ethers.getContractAt("IERC721", process.env.UNISWAP_NFT_ADDRESS, ownerWallet);


        const count = await nftToken.balanceOf(vaultManagerAddress);
        console.log(`ERC721 token count in contract ${vaultManagerAddress}: ${count.toString()}`);

        const countMarc = await nftToken.balanceOf(marcWallet.address);
        console.log(`ERC721 token count in marcWallet ${marcWallet.address}: ${countMarc.toString()}`);
        
        const tokenIds = [4469229n];

        // The contract ERC20 MainToken Balance should be sent to MarcWallet
        const tx1 = await VaultManager.emergencyERC721BatchWithdrawal(process.env.UNISWAP_NFT_ADDRESS, tokenIds, marcWallet.address);
        await tx1.wait();

        
        const count1 = await nftToken.balanceOf(vaultManagerAddress);
        console.log(`ERC721 token count in contract after sending ${vaultManagerAddress}: ${count1.toString()}`);

        const countMarc1 = await nftToken.balanceOf(marcWallet.address);
        console.log(`ERC721 token count in marcWallet ${marcWallet.address}: ${countMarc1.toString()}`);

    });

});