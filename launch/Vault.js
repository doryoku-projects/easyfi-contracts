const { getImplementationAddress } = require("@openzeppelin/upgrades-core");
const { ethers, upgrades } = require("hardhat");
require("dotenv").config();

async function main() {
  console.log("[DEPLOY] Deploying VaultProxy on Tenderly.");

  const protocolConfigAddress = process.env.PROTOCOL_CONFIG_ADDRESS;
  const userManagerUpgradeableAddress = process.env.USER_MANAGER_ADDRESS;
  const maxWithdrawalSize = 150;

  const VaultManagerUpgradeable = await ethers.getContractFactory(
    "VaultManagerUpgradeable"
  );

  const vault = await upgrades.deployProxy(
    VaultManagerUpgradeable,
    [protocolConfigAddress, userManagerUpgradeableAddress, maxWithdrawalSize],
    {
      initializer: "initialize",
    }
  );

  const vaultContract = await vault.waitForDeployment();

  console.log(`[DEPLOY] VaultProxy deployed to: ${vaultContract.address}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
