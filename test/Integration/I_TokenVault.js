const { expect } = require("chai");
const { ethers, upgrades } = require("hardhat");
require("dotenv").config();
const { getDeploymentAddress } = require("../../launch/DeploymentStore");
const CONFIG = require("../../launch/config");

describe("TokenVaultUpgradeable (Real Contracts)", function () {
    let tokenVault;
    let userManager;
    let token;
    let owner, user, managerWallet, feeCollector, other, userWallet;
    let entryFeeBps = 100;
    let exitFeeBps = 200;

    let USER_MANAGER_ADDRESS;
    let TOKEN_VAULT_ADDRESS;
    let WETH_ADDRESS;
    let addressesPerChain;

    let ownerWallet, generalAdminWallet, userManagerWallet;

    before(async function () {
        const network = await ethers.provider.getNetwork();
        const chainId = Number(network.chainId);
        addressesPerChain = CONFIG.ADDRESSES_PER_CHAIN[chainId];

        USER_MANAGER_ADDRESS = await getDeploymentAddress("UserManagerUpgradeable");
        TOKEN_VAULT_ADDRESS = await getDeploymentAddress("TokenVaultUpgradeable");
        WETH_ADDRESS = addressesPerChain.TOKEN0_ADDRESS;

        console.log(TOKEN_VAULT_ADDRESS, "TOKEN_VAULT_ADDRESS");

        [owner, user, managerWallet, feeCollector, other] = await ethers.getSigners();

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
    });

    describe("Initialization", function () {
        it("Should set the correct initial values", async function () {
            expect(await tokenVault.getManagerWallet()).to.equal(ownerWallet.address);
            expect(await tokenVault.getFeeCollector()).to.equal(ownerWallet.address);
            expect(await tokenVault.getEntryFeeBps()).to.equal(entryFeeBps);
            expect(await tokenVault.getExitFeeBps()).to.equal(exitFeeBps);

            console.log("TokenVault initialized successfully");
        });
    });

    describe("Admin Functions", function () {
        it("Should allow admin to set yield", async function () {
            const yieldId = 1;
            const lockDuration = 30 * 24 * 60 * 60;
            const aprBps = 1000;
            const isActive = true;

            await tokenVault.connect(generalAdminWallet).setYield(WETH_ADDRESS, yieldId, lockDuration, aprBps, isActive);

            const yield = await tokenVault.getYield(WETH_ADDRESS, yieldId);
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
            await token.connect(userWallet).approve(await tokenVault.getAddress(), amount);
        });

        it("Should allow user to deposit real WETH", async function () {
            const entryFee = (amount * BigInt(entryFeeBps)) / 10000n;
            const netAmount = amount - entryFee;

            console.log(await token.balanceOf(userWallet.address));
            const tx = await tokenVault.connect(userWallet).deposit(WETH_ADDRESS, yieldId, amount);
            await expect(tx).to.emit(tokenVault, "VaultDeposit");

            expect(await token.balanceOf(managerWallet.address)).to.be.at.least(netAmount);

            console.log(await tokenVault.getUserActiveDeposits(userWallet.address));
            const deposit = await tokenVault.getDeposit(1);
            expect(deposit.user).to.equal(userWallet.address);
            expect(deposit.principal).to.equal(netAmount);
            console.log("Deposit successful");
        });
    });

    describe("User Functions - Withdraw", function () {
        const depositId = 1;

        before(async function () {
            await token.connect(managerWallet).approve(await tokenVault.getAddress(), ethers.MaxUint256);
        });

        it("Should allow user to withdraw after lock period", async function () {
            await ethers.provider.send("evm_increaseTime", [30 * 24 * 60 * 60 + 1]);
            await ethers.provider.send("evm_mine");

            const deposit = await tokenVault.getDeposit(depositId);
            const duration = deposit.unlockTimestamp - deposit.depositTimestamp;
            const growth = (deposit.principal * deposit.aprBps * duration) / (BigInt(365 * 24 * 3600) * 10000n);
            const totalPayout = deposit.principal + growth;
            const exitFee = (totalPayout * BigInt(exitFeeBps)) / 10000n;
            const finalAmount = totalPayout - exitFee;

            const userBalanceBefore = await token.balanceOf(userWallet.address);
            await token.connect(ownerWallet).transfer(await tokenVault.getAddress(), ethers.parseEther("20"));
            console.log("deposit",deposit)
            await expect(tokenVault.connect(userWallet).withdraw(depositId))
                .to.emit(tokenVault, "VaultWithdrawal");

            console.log(await tokenVault.getUserActiveDeposits(userWallet.address));

            console.log("userBalanceBefore", userBalanceBefore, "userBalanceAfter" , await token.balanceOf(userWallet.address));
            expect(await token.balanceOf(userWallet.address)).to.equal(userBalanceBefore + finalAmount);

            const depositAfter = await tokenVault.getDeposit(depositId);
            expect(depositAfter.withdrawn).to.equal(true);
            console.log("Withdrawal successful");
        });
    });
});
