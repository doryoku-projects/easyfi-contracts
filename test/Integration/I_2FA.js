const { expect } = require("chai");
const { ethers } = require("hardhat");
require("dotenv").config();
const { getDeploymentAddress } = require("../../launch/DeploymentStore");

describe("AggregatorUpgradeable — decreaseLiquidityFromPosition 2FA tests", function () {
    let owner, generalAdmin, userManagerSigner, user2FASigner, user;
    let aggregator, userManager, protocolConfig;
    let aggregatorAddress, protocolConfigAddress, userManagerAddress;

    const TWO_FA_KEY = ethers.keccak256(ethers.toUtf8Bytes("2FARequired"));
    const POOL_ID = "WETH-USDC";
    const PERCENT = 100;
    const VALUE = 0;

    async function get2FAStatus() {
        const liquidityManagerAddr = await getDeploymentAddress("LiquidityManagerUpgradeable");

        let impersonated = false;
        let liquiditySigner;
        let keyValueNum;
        try {
            try {
                liquiditySigner = await ethers.getSigner(liquidityManagerAddr);
            } catch (e) {
                await ethers.provider.send("hardhat_impersonateAccount", [liquidityManagerAddr]);
                impersonated = true;
                liquiditySigner = await ethers.getSigner(liquidityManagerAddr);
            }

            const protocolAsLM = protocolConfig.connect(liquiditySigner);
            const keyValue = await protocolAsLM.getUint(ethers.keccak256(ethers.toUtf8Bytes("2FARequired")));
            keyValueNum = Number(keyValue.toString());
        } finally {
            if (impersonated) {
                await ethers.provider.send("hardhat_stopImpersonatingAccount", [liquidityManagerAddr]);
            }
        }
        return keyValueNum;
    }

    before(async function () {
        // --- Setup signers
        owner = new ethers.Wallet(process.env.MASTER_ADMIN_PRIVATE_KEY, ethers.provider);
        generalAdmin = new ethers.Wallet(process.env.GENERAL_ADMIN_PRIVATE_KEY, ethers.provider);
        userManagerSigner = new ethers.Wallet(process.env.USER_MANAGER_PRIVATE_KEY, ethers.provider);
        user2FASigner = new ethers.Wallet(process.env.USER_2FA_PRIVATE_KEY, ethers.provider);
        user = new ethers.Wallet(process.env.USER_PRIVATE_KEY, ethers.provider);

        // --- Get deployed addresses
        protocolConfigAddress = await getDeploymentAddress("ProtocolConfigUpgradeable");
        aggregatorAddress = await getDeploymentAddress("AggregatorUpgradeable");
        userManagerAddress = await getDeploymentAddress("UserManagerUpgradeable");

        // --- Attach contracts
        protocolConfig = await ethers.getContractAt("ProtocolConfigUpgradeable", protocolConfigAddress, generalAdmin);
        userManager = await ethers.getContractAt("UserManagerUpgradeable", userManagerAddress, generalAdmin);
        aggregator = await ethers.getContractAt("AggregatorUpgradeable", aggregatorAddress, user);

    });

    it("2FA enabled → wrong code should revert", async function () {
        // --- Step 1: Enable 2FA in protocol config
        (await get2FAStatus()) !== 1 ? await protocolConfig.connect(generalAdmin).setUint(TWO_FA_KEY, 1) : null;

        // --- Step 2: Set 2FA info for the user
        const code = "111111"; // actual code stored in UserManager
        const expiredTime = Math.floor(Date.now() / 1000) + 300; // 5 minutes
        const value = 0;

        // create message hash for signature
        const messageHash = ethers.solidityPackedKeccak256(
            ["address","uint256","address","uint256","uint256"],
            [user.address, 42161, userManager.target, value, expiredTime]
        );

        const signature = await user.signMessage(ethers.getBytes(messageHash));

        // set 2FA entry
        await userManager.connect(user2FASigner).set2FA(user.address, code, expiredTime, value, signature);

        // --- Step 3: Call aggregator with wrong code
        const wrongCode = "123456";
        await expect(
            aggregator.connect(user).decreaseLiquidityFromPosition(
                POOL_ID,
                PERCENT,
                wrongCode
            )
        ).to.be.revertedWithCustomError(userManager, "UM_INVALID_2FA_CODE");


        await expect(
            aggregator.connect(user).collectFeesFromPosition(
                POOL_ID,
                wrongCode
            )
        ).to.be.revertedWithCustomError(userManager, "UM_INVALID_2FA_CODE");
    });


    it("2FA enabled → correct code should pass 2FA (may revert later for vault)", async function () {
        // --- Step 1: Enable 2FA in protocol config
        (await get2FAStatus()) !== 1 ? await protocolConfig.connect(generalAdmin).setUint(TWO_FA_KEY, 1) : null;

        // --- Step 2: Set 2FA info for the user
        const code = "111111";
        const expiredTime = Math.floor(Date.now() / 1000) + 300; // 5 minutes
        const value = PERCENT;

        // create message hash for signature
        const messageHash = ethers.solidityPackedKeccak256(
            ["address","uint256","address","uint256","uint256"],
            [user.address, 42161, userManager.target, value, expiredTime]
        );

        // sign hash using the user wallet
        const signature = await user.signMessage(ethers.getBytes(messageHash));

        // set 2FA entry
        await userManager.connect(user2FASigner).set2FA(user.address, code, expiredTime, value, signature);

        // Call decreaseLiquidityFromPosition → may revert, but NOT due to 2FA
        const tx = aggregator.connect(user).decreaseLiquidityFromPosition(
            POOL_ID,
            PERCENT,
            code
        );

        await expect(tx).to.be.reverted; // it may revert

        // asserting that it did NOT revert due to 2FA errors
        await expect(tx).to.not.be.revertedWithCustomError(userManager, "UM_INVALID_2FA_CODE");
        await expect(tx).to.not.be.revertedWithCustomError(userManager, "UM_INVALID_2FA_INVALID_SIGNATURE");
        await expect(tx).to.not.be.revertedWithCustomError(userManager, "UM_2FA_CODE_EXPIRED");
        await expect(tx).to.not.be.revertedWithCustomError(userManager, "UM_INVALID_2FA_VALUE");

    });


    it("2FA disabled → code ignored, call may revert for other reasons", async function () {
        // Disable 2FA in ProtocolConfig
        (await get2FAStatus()) !== 2 ? await protocolConfig.connect(generalAdmin).setUint(TWO_FA_KEY, 2) : null;

        const dummyCode = "ANY_CODE";

        const tx = aggregator.connect(user).decreaseLiquidityFromPosition(
            POOL_ID,
            PERCENT,
            dummyCode
        );

        await expect(tx).to.be.reverted; // it may revert, just assert that

        // Then separately assert that it did NOT revert due to 2FA errors
        await expect(tx).to.not.be.revertedWithCustomError(userManager, "UM_INVALID_2FA_CODE");
        await expect(tx).to.not.be.revertedWithCustomError(userManager, "UM_INVALID_2FA_INVALID_SIGNATURE");
        await expect(tx).to.not.be.revertedWithCustomError(userManager, "UM_2FA_CODE_EXPIRED");
        await expect(tx).to.not.be.revertedWithCustomError(userManager, "UM_INVALID_2FA_VALUE");
    });
});
