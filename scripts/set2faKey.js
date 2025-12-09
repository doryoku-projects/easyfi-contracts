const { ethers } = require("hardhat");
const { getDeploymentAddress } = require("../launch/DeploymentStore");


async function main() {
    const [new_addr, owner , marcWallet,] = await ethers.getSigners();
    const ProtocolConfigAddr = await getDeploymentAddress("ProtocolConfigUpgradeable");
    const ProtocolConfigContract = await ethers.getContractAt("ProtocolConfigUpgradeable", ProtocolConfigAddr, marcWallet);

    await ProtocolConfigContract.setUint(ethers.keccak256(ethers.toUtf8Bytes("2FARequired")),2); // 1 for enabled, 2 for disabled

    const liquidityManagerAddr = await getDeploymentAddress("LiquidityManagerUpgradeable");

    let impersonated = false;
    let liquiditySigner;
    try {
        try {
            liquiditySigner = await ethers.getSigner(liquidityManagerAddr);
        } catch (e) {
            await ethers.provider.send("hardhat_impersonateAccount", [liquidityManagerAddr]);
            impersonated = true;
            liquiditySigner = await ethers.getSigner(liquidityManagerAddr);
        }

        const protocolAsLM = ProtocolConfigContract.connect(liquiditySigner);
        const keyValue = await protocolAsLM.getUint(ethers.keccak256(ethers.toUtf8Bytes("2FARequired")));
        const keyValueNum = Number(keyValue.toString());
    } finally {
        if (impersonated) {
            await ethers.provider.send("hardhat_stopImpersonatingAccount", [liquidityManagerAddr]);
        }
    }
}

main().then(() => process.exit(0)).catch((error) => {
    console.error("   Deployment failed:", error);
    process.exit(1);
})