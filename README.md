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
npx cross-env WHITELABEL="easyfi_test" hardhat run ./launch/deployAll.js --network localhost
```

### STEP 3 - Run Role setting 

# NOTICE: set the env var for WHITELABEL

```bash
npx cross-env WHITELABEL="easyfi_test" hardhat test test/Integration/I_rolesetingNuevo.js --network localhost
```

### To test All Interactions

```bash
npx cross-env WHITELABEL="easyfi_test" hardhat test test/Integration/I_rolesetingNuevo.js --network localhost
```

# Set of Whitelabels
- `banana`
- `wadz`

### To Run Upgrade Script

```bash
# For localhost/testnet
npx cross-env WHITELABEL="wadz_test2" hardhat run ./launch/upgrade/upgradeAggregator.js --network localhost

# For mainnet
npx cross-env WHITELABEL="wadz_test2" hardhat run ./launch/upgrade/upgradeAggregator.js --network arbitrumOne
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

## Deploy and update role setting in s single script

```bash
# Makes the file executable so it can be run directly.
chmod +x run.sh

# Run the script
./run.sh
```

# To run the Upgrade Script via MultiSig

- Update the commands like WHITELABEL, CONTRACT name and FUNCTION_NAME name.
- Function name should be the function name in the script.

```bash
npx cross-env WHITELABEL="wadz_test2" CONTRACT="VaultManagerUpgradeable"  FUNCTION_NAME=newImplementation hardhat run scripts/UpgradeWithMultisig.js --network arbitrumOne
```

# To run the Call the Function Script via MultiSig

- Update the token address "tokens" and recipient address "To" in the script
- Function name should be the function name in the script.
- Update the commands like contract name and function name

```bash
npx cross-env WHITELABEL="wadz_test2" CONTRACT="VaultManagerUpgradeable"  FUNCTION_NAME=encodeEmergencyWithdraw hardhat run scripts/EmergencyWithdrawWithMultisig.js --network arbitrumOne
```
