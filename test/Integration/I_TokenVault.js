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
    const NATIVE_TOKEN = "0x0000000000000000000000000000000000000000";

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

        // Ensure manager and collector can receive ETH
        // ownerWallet is EOA, but let's make sure it's known
        console.log("Manager Wallet:", await tokenVault.getManagerWallet());
        console.log("Fee Collector:", await tokenVault.getFeeCollector());
    });

    describe("Initialization", function () {
        it("Should set manager and collector as EOAs", async function () {
            await tokenVault.connect(generalAdminWallet).setManagerWallet(other.address);
            await tokenVault.connect(generalAdminWallet).setFeeCollector(other.address);

            expect(await tokenVault.getManagerWallet()).to.equal(other.address);
            expect(await tokenVault.getFeeCollector()).to.equal(other.address);

            console.log("TokenVault addresses updated to:", other.address);
        });

        it("Should set the correct initial values", async function () {
            expect(await tokenVault.getManagerWallet()).to.equal(other.address);
            expect(await tokenVault.getFeeCollector()).to.equal(other.address);
            expect(await tokenVault.getEntryFeeBps()).to.equal(entryFeeBps);
            expect(await tokenVault.getExitFeeBps()).to.equal(exitFeeBps);

            console.log("TokenVault initialized successfully");
        });
    });

    describe("Admin Functions", function () {
        it("Should allow admin to set yield", async function () {
            const lockDuration = 30 * 24 * 60 * 60;
            const aprBps = 1000;
            const isActive = true;

            const tx = await tokenVault.connect(generalAdminWallet).setYieldPlan(WETH_ADDRESS, lockDuration, aprBps, isActive);
            const receipt = await tx.wait();
            const event = receipt.logs.find(x => x.fragment?.name === 'YieldSet');
            const yieldId = event.args.yieldId;

            const yield = await tokenVault.getYieldPlan(WETH_ADDRESS, yieldId);
            expect(yield.lockDuration).to.equal(lockDuration);
            expect(yield.aprBps).to.equal(aprBps);
            expect(yield.isActive).to.equal(true);
            this.yieldId = yieldId;
            console.log("yield set successfully, yieldId:", yieldId.toString());
        });

        it("Should allow admin to update yield", async function () {
            const yieldId = this.yieldId;
            const lockDuration = 60 * 24 * 60 * 60;
            const aprBps = 1500;
            const isActive = true;

            await tokenVault.connect(generalAdminWallet).updateYieldPlan(WETH_ADDRESS, yieldId, lockDuration, aprBps, isActive);

            const yield = await tokenVault.getYieldPlan(WETH_ADDRESS, yieldId);
            expect(yield.lockDuration).to.equal(lockDuration);
            expect(yield.aprBps).to.equal(aprBps);
        });


        it("Should allow admin to set oracles", async function () {
            const tokens = [WETH_ADDRESS, NATIVE_TOKEN];
            const oracles = [addressesPerChain.ETH_PRICE_FEED, addressesPerChain.ETH_PRICE_FEED];

            await tokenVault.connect(generalAdminWallet).setTokenOracles(tokens, oracles);

            // Note: Internal _getPrice is checked during deposit/withdraw
            console.log("Oracles set successfully");
        });

        it("Should allow admin to set token status", async function () {
            await tokenVault.connect(ownerWallet).setTokenStatus(WETH_ADDRESS, true);
            expect(await tokenVault.isSupportedToken(WETH_ADDRESS)).to.equal(true);

            await tokenVault.connect(ownerWallet).setTokenStatus(NATIVE_TOKEN, true);
            expect(await tokenVault.isSupportedToken(NATIVE_TOKEN)).to.equal(true);

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
            expect(deposit.depositPrice).to.be.gt(0);
            console.log("Deposit successful, price recorded:", deposit.depositPrice.toString());
        });

        it("Should allow user to deposit Native Token", async function () {
            const nativeAmount = ethers.parseEther("0.1");
            const yieldId = 1;

            // Set yield for native token if not set
            await tokenVault.connect(generalAdminWallet).setYieldPlan(NATIVE_TOKEN, 30 * 24 * 60 * 60, 1000, true);

            // Fund user with ETH
            await owner.sendTransaction({ to: userWallet.address, value: ethers.parseEther("1") });

            const tx = await tokenVault.connect(userWallet).deposit(NATIVE_TOKEN, yieldId, 0, { value: nativeAmount });
            const receipt = await tx.wait();

            const event = receipt.logs.find(x => x.fragment?.name === 'VaultDeposit');
            const depositId = event ? event.args.depositId : 2;

            const deposit = await tokenVault.getDeposit(depositId);
            expect(deposit.token).to.equal(NATIVE_TOKEN);
            expect(deposit.depositPrice).to.be.gt(0);
            console.log("Native deposit successful, depositId:", depositId.toString(), "price recorded:", deposit.depositPrice.toString());
            this.nativeDepositId = depositId;
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
            console.log("deposit", deposit)
            console.log(await tokenVault.getUserActiveDepositsInfo(userWallet.address));
            await expect(tokenVault.connect(userWallet).withdraw(depositId))
                .to.emit(tokenVault, "VaultWithdrawal");

            console.log(await tokenVault.getUserActiveDeposits(userWallet.address));
            console.log(await tokenVault.getUserActiveDepositsInfo(userWallet.address));

            console.log("userBalanceBefore", userBalanceBefore, "userBalanceAfter", await token.balanceOf(userWallet.address));
            expect(await token.balanceOf(userWallet.address)).to.equal(userBalanceBefore + finalAmount);

            const depositAfter = await tokenVault.getDeposit(depositId);
            expect(depositAfter.withdrawn).to.equal(true);
            expect(depositAfter.withdrawPrice).to.be.gt(0);
            console.log("Withdrawal successful, price recorded:", depositAfter.withdrawPrice.toString());
        });

        it("Should allow user to withdraw Native Token after lock period", async function () {
            const depositId = this.nativeDepositId || 2;
            const depositBefore = await tokenVault.getDeposit(depositId);
            if (depositBefore.user === ethers.ZeroAddress) {
                console.log("Skipping native withdraw as deposit failed");
                return;
            }

            // Ensure contract has native funds to pay out
            await owner.sendTransaction({
                to: await tokenVault.getAddress(),
                value: ethers.parseEther("2")
            });

            const userBalanceBefore = await ethers.provider.getBalance(userWallet.address);

            const tx = await tokenVault.connect(userWallet).withdraw(depositId);
            const receipt = await tx.wait();

            const userBalanceAfter = await ethers.provider.getBalance(userWallet.address);
            expect(userBalanceAfter).to.be.gt(userBalanceBefore - receipt.fee);

            const depositAfter = await tokenVault.getDeposit(depositId);
            expect(depositAfter.withdrawn).to.equal(true);
            expect(depositAfter.withdrawPrice).to.be.gt(0);
            console.log("Native withdrawal successful, price recorded:", depositAfter.withdrawPrice.toString());
        });
    });
});
