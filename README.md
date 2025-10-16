### Install packages
```bash
npm install –force
```

### To Run Locally

```bash
npx hardhat node --network hardhat
```

### STEP 1 - Deploy Factory
```bash
npx hardhat run ./launch/factory.js --network localhost
```

### STEP 2 - Deploy contracts 

# NOTICE: set the env var for WHITELABEL for which the contract are to be deployed

```bash
npx cross-env WHITELABEL="wadz" hardhat run ./launch/deployAll.js --network localhost
```

# Set of Whitelabels
- `banana`
- `wadz`

### To Run Upgrade Script

```bash
# For localhost/testnet
npx hardhat run ./launch/upgrade/upgradeAggregator.js --network localhost

# For mainnet
npx hardhat run ./launch/upgrade/upgradeAggregator.js --network arbitrum
```

## Available Upgrade Scripts

- `upgradeUserManager.js` - Upgrades UserManagerUpgradeable
- `upgradeProtocolConfig.js` - Upgrades ProtocolConfigUpgradeable
- `upgradeAggregator.js` - Upgrades AggregatorUpgradeable
- `upgradeVault.js` - Upgrades VaultManagerUpgradeable
- `upgradeLiquidityManager.js` - Upgrades LiquidityManagerUpgradeable
- `upgradeLiquidityHelper.js` - Upgrades LiquidityHelperUpgradeable
- `upgradeOracleSwap.js` - Upgrades OracleSwapUpgradeable

## Upgrading with Reinitialization

If your new implementation has an `initializeV2` function:

```javascript
await upgradeContract({
  contractName: "AggregatorUpgradeableV2",
  proxyStorageKey: "AggregatorUpgradeable",
  reinitializeFunctionName: "initializeV2",
  reinitializeArgs: [1000, "0xAddress"]
});
```