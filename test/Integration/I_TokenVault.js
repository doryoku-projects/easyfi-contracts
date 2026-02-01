const { expect } = require("chai");
const { ethers, upgrades } = require("hardhat");
require("dotenv").config();
const { getDeploymentAddress } = require("../../launch/DeploymentStore");
const CONFIG = require("../../launch/config");
const { anyValue } = require("@nomicfoundation/hardhat-chai-matchers/withArgs");

describe("TokenVaultUpgradeable (Real Contracts)", function () {
    let tokenVault;
    let VaultDepositNFT;
    let userManager;
    let token;
    let owner, user, managerWallet, feeCollector, other, userWallet;
    let entryFeeBps = 100;
    let exitFeeBps = 200;

    let USER_MANAGER_ADDRESS;
    let TOKEN_VAULT_ADDRESS;
    let VAULT_DEPOSIT_NFT_ADDRESS;
    let WETH_ADDRESS;
    let addressesPerChain;

    let ownerWallet, generalAdminWallet, userManagerWallet;

    before(async function () {
        const network = await ethers.provider.getNetwork();
        const chainId = Number(network.chainId);
        addressesPerChain = CONFIG.ADDRESSES_PER_CHAIN[chainId];

        USER_MANAGER_ADDRESS = await getDeploymentAddress("UserManagerUpgradeable");
        TOKEN_VAULT_ADDRESS = await getDeploymentAddress("TokenVaultUpgradeable");
        VAULT_DEPOSIT_NFT_ADDRESS = await getDeploymentAddress("VaultDepositNFTUpgradeable");
        WETH_ADDRESS = addressesPerChain.TOKEN0_ADDRESS;

        console.log(TOKEN_VAULT_ADDRESS, "TOKEN_VAULT_ADDRESS");
        console.log(VAULT_DEPOSIT_NFT_ADDRESS, "VAULT_DEPOSIT_NFT_ADDRESS");

        [,, , managerWallet, , ] = await ethers.getSigners();

        ownerWallet = new ethers.Wallet(
            process.env.MASTER_ADMIN_PRIVATE_KEY,
            ethers.provider
        );
        generalAdminWallet = new ethers.Wallet(
            process.env.GENERAL_ADMIN_PRIVATE_KEY,
            ethers.provider
        );
        userManagerWallet = new ethers.Wallet(
            process.env.USER_MANAGER_PRIVATE_KEY,
            ethers.provider
        );

        userWallet = new ethers.Wallet(
            process.env.USER_PRIVATE_KEY,
            ethers.provider
        );

        console.log("userWallet = ", userWallet.address);
        

        userManager = await ethers.getContractAt(
            "UserManagerUpgradeable",
            USER_MANAGER_ADDRESS,
            generalAdminWallet
        );

        const GENERAL_ADMIN_ROLE = ethers.keccak256(ethers.toUtf8Bytes("GENERAL_ADMIN_ROLE"));
        const USER_ROLE = ethers.keccak256(ethers.toUtf8Bytes("USER_ROLE"));

        if (!(await userManager.hasRole(GENERAL_ADMIN_ROLE, generalAdminWallet.address))) {
            await userManager.connect(ownerWallet).addGeneralAdmins([generalAdminWallet.address]);
        }
        if (!(await userManager.hasRole(USER_ROLE, userWallet.address))) {
            await userManager.connect(ownerWallet).addUsers([userWallet.address]);
        }

        const IWETH_ABI = [
            "function deposit() payable",
            "function withdraw(uint256)",
            "function balanceOf(address) view returns (uint256)",
            "function approve(address, uint256) returns (bool)",
            "function transfer(address, uint256) returns (bool)"
        ];

        token = new ethers.Contract(
            WETH_ADDRESS,
            IWETH_ABI,
            ownerWallet
        );
        await token.deposit({ value: ethers.parseEther("100") });


        await token.transfer(userWallet.address, ethers.parseEther("10"));
        await token.transfer(managerWallet.address, ethers.parseEther("10"));

        tokenVault = await ethers.getContractAt(
            "TokenVaultUpgradeable",
            TOKEN_VAULT_ADDRESS,
            generalAdminWallet
        );

        VaultDepositNFT = await ethers.getContractAt(
            "VaultDepositNFTUpgradeable",
            VAULT_DEPOSIT_NFT_ADDRESS,
            generalAdminWallet
        );
    });

    describe("Initialization", function () {
        it("Should set the correct initial values", async function () {
            expect((await tokenVault.getManagerWallet()).toLowerCase()).to.equal(process.env.MASTER_ADMIN_WALLET.toLowerCase());
            expect((await tokenVault.getFeeCollector()).toLowerCase()).to.equal(process.env.CLIENT_ADDRESS.toLowerCase());
            expect(await tokenVault.getEntryFeeBps()).to.equal(entryFeeBps);
            expect(await tokenVault.getExitFeeBps()).to.equal(exitFeeBps);
            expect((await tokenVault.getDepositNFTAddress()).toLowerCase()).to.equal(VAULT_DEPOSIT_NFT_ADDRESS.toLowerCase());
            console.log("TokenVault initialized successfully");
        });
    });

    describe("check contract updates", function () {
        it("should have the new functions after upgrade", async function () {
            expect(tokenVault.fundUpcomingWithdrawals).to.be.a("function");
            expect(tokenVault.returnExcessFunds).to.be.a("function");
            console.log("Upgrade verified successfully");
        });
    });

    describe("Admin Functions", function () {
        it("Should allow admin to set yield", async function () {
            const yieldId = 1;
            const lockDuration = 30 * 24 * 60 * 60;
            const aprBps = 1000;
            const isActive = true;

            await tokenVault.connect(generalAdminWallet).setYieldPlan(WETH_ADDRESS, yieldId, lockDuration, aprBps, isActive);

            const yield = await tokenVault.getYieldPlan(WETH_ADDRESS, yieldId);
            expect(yield.lockDuration).to.equal(lockDuration);
            expect(yield.aprBps).to.equal(aprBps);
            expect(yield.isActive).to.equal(true);
            console.log("yield set successfully");
        });

        it("Should allow admin to set token status", async function () {
            await tokenVault.connect(ownerWallet).setTokenStatus(WETH_ADDRESS, true);
            expect(await tokenVault.isSupportedToken(WETH_ADDRESS)).to.equal(true);
            console.log("Token status set successfully");
        });
    });

    describe("User Functions - Deposit", function () {
        const yieldId = 1;
        const amount = ethers.parseUnits("1", 18);

        before(async function () {
            // Enable the token for deposits
            await tokenVault.connect(ownerWallet).setTokenStatus(WETH_ADDRESS, true);
            
            // Set yield plan for the token
            const lockDuration = 30 * 24 * 60 * 60; // 30 days
            const aprBps = 1000; // 10%
            await tokenVault.connect(generalAdminWallet).setYieldPlan(
                WETH_ADDRESS,
                yieldId,
                lockDuration,
                aprBps,
                true
            );
            
            await token.connect(userWallet).approve(await tokenVault.getAddress(), amount);

            console.log("#### token.balanceOf Vault = ", await token.balanceOf(await tokenVault.getAddress()));
            
        });

        it("Should allow user to deposit real WETH", async function () {
            const entryFee = (amount * BigInt(entryFeeBps)) / 10000n;
            const netAmount = amount - entryFee;
            
            const tx = await tokenVault.connect(userWallet).deposit(WETH_ADDRESS, yieldId, amount);
            const receipt = await tx.wait();

            // Parse the VaultDeposit event from the receipt
            const event = receipt.logs
                .map(log => {
                    try {
                        return tokenVault.interface.parseLog(log);
                    } catch (e) {
                        return null;
                    }
                })
                .find(log => log && log.name === 'VaultDeposit');

            const depositId = event.args.depositId;
            console.log("Deposit ID:", depositId.toString());

            expect(await token.balanceOf(managerWallet.address)).to.be.at.least(netAmount);

            const deposit = await tokenVault.getDeposit(depositId);
            expect(deposit.user).to.equal(userWallet.address);
            expect(deposit.netPrincipal).to.equal(netAmount);

            expect(await VaultDepositNFT.ownerOf(depositId)).to.equal(userWallet.address);
            console.log("Deposit successful");
            console.log("getUserActiveDeposits = ", await tokenVault.getUserActiveDeposits(userWallet.address));
            console.log("#### after deposit - token.balanceOf Vault = ", await token.balanceOf(await tokenVault.getAddress()));
        });
    });

    describe("Admin Functions - Fund Withdrawals", function () {
        it("Should allow admin to fund upcoming withdrawals", async function () {
            const fundAmount = ethers.parseUnits("5", 18);
            await token.connect(ownerWallet).approve(await tokenVault.getAddress(), fundAmount);

            const vaultBalanceBefore = await token.balanceOf(await tokenVault.getAddress());

            await expect(tokenVault.connect(ownerWallet).fundUpcomingWithdrawals(await token.getAddress(), fundAmount))
                .to.emit(tokenVault, "WithdrawalsFunded")
                .withArgs(token, fundAmount, anyValue);

            const vaultBalanceAfter = await token.balanceOf(await tokenVault.getAddress());
            expect(vaultBalanceAfter).to.equal(vaultBalanceBefore + fundAmount);
            console.log("Funded upcoming withdrawals successfully");
        });
    });

    describe("User Functions - Withdraw", function () {
        let depositId;

        before(async function () {
            await token.connect(managerWallet).approve(await tokenVault.getAddress(), ethers.MaxUint256);
            const deposits = await tokenVault.getUserActiveDeposits(userWallet.address);
            console.log("deposits = ", deposits);
            
            depositId = deposits[0]; // Use first active deposit
            console.log("Using Deposit ID:", depositId.toString());

            console.log("#### Befor withdraw - token.balanceOf Vault = ", await token.balanceOf(await tokenVault.getAddress()));
        });

        it("Should allow user to withdraw after lock period", async function () {
            await ethers.provider.send("evm_increaseTime", [30 * 24 * 60 * 60 + 1]);
            await ethers.provider.send("evm_mine");

            const deposit = await tokenVault.getDeposit(depositId);
            const yieldPlan = await tokenVault.getYieldPlan(deposit.token, deposit.yieldId);
            const duration = deposit.unlockTimestamp - deposit.depositTimestamp;
            const growth = (deposit.netPrincipal * yieldPlan.aprBps * duration) / (BigInt(365 * 24 * 3600) * 10000n);
            const totalPayout = deposit.netPrincipal + growth;
            const exitFee = (totalPayout * BigInt(exitFeeBps)) / 10000n;
            const finalAmount = totalPayout - exitFee;

            const userBalanceBefore = await token.balanceOf(userWallet.address);
            // await token.connect(ownerWallet).transfer(await tokenVault.getAddress(), ethers.parseEther("20"));
            
            await expect(tokenVault.connect(userWallet).withdraw(depositId, totalPayout))
                .to.emit(tokenVault, "VaultWithdrawal");

            console.log("userBalanceBefore", userBalanceBefore, "userBalanceAfter" , await token.balanceOf(userWallet.address));
            expect(await token.balanceOf(userWallet.address)).to.equal(userBalanceBefore + finalAmount);

            const depositAfter = await tokenVault.getDeposit(depositId);
            expect(depositAfter.withdrawn).to.equal(true);

            await expect(VaultDepositNFT.ownerOf(depositId))
                .to.be.revertedWithCustomError(VaultDepositNFT, "ERC721NonexistentToken")
                .withArgs(depositId);
            console.log("Withdrawal successful");

            console.log("#### After withdraw - token.balanceOf Vault = ", await token.balanceOf(await tokenVault.getAddress()));
        });
    });

    describe("Admin Functions - Return Excess Funds", function () {
        it("Should allow admin to return excess funds", async function () {
            const returnAmount = ethers.parseUnits("2", 18);
            const vaultBalanceBefore = await token.balanceOf(await tokenVault.getAddress());
            const OwnerBalanceBefore = await token.balanceOf(ownerWallet.address);

            await expect(tokenVault.connect(ownerWallet).returnExcessFunds(await token.getAddress(), returnAmount))
                .to.emit(tokenVault, "FundsReturned")
                .withArgs(token, returnAmount, anyValue);

            const vaultBalanceAfter = await token.balanceOf(await tokenVault.getAddress());
            const OwnerBalanceAfter = await token.balanceOf(ownerWallet.address);

            expect(vaultBalanceAfter).to.equal(vaultBalanceBefore - returnAmount);
            expect(OwnerBalanceAfter).to.equal(OwnerBalanceBefore + returnAmount);
            console.log("Returned excess funds successfully");
        });

        it("Should allow admin to return all funds", async function () {
            const vaultBalanceBefore = await token.balanceOf(await tokenVault.getAddress());
            const OwnerBalanceBefore = await token.balanceOf(ownerWallet.address);

            await expect(tokenVault.connect(ownerWallet).returnExcessFunds(await token.getAddress(), vaultBalanceBefore))
                .to.emit(tokenVault, "FundsReturned")
                .withArgs(token, vaultBalanceBefore, anyValue);

            const vaultBalanceAfter = await token.balanceOf(await tokenVault.getAddress());
            const OwnerBalanceAfter = await token.balanceOf(ownerWallet.address);

            expect(vaultBalanceAfter).to.equal(0n);
            expect(OwnerBalanceAfter).to.equal(OwnerBalanceBefore + vaultBalanceBefore);
            console.log("Returned full funds successfully");
        });
    });
});
