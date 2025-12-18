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

### To run setting 2fa key for Protocol Config Contract
``` bash
npx cross-env WHITELABEL="wadz" hardhat run scripts\set2faKey.js --network localhost
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

1. encodeEmergencyWithdraw

```bash
npx cross-env WHITELABEL="wadz_test2" CONTRACT="VaultManagerUpgradeable"  FUNCTION_NAME=encodeEmergencyWithdraw hardhat run scripts/EmergencyWithdrawWithMultisig.js --network arbitrumOne
```

2. encodeSetMaxWithdrawalSize

```bash
npx cross-env WHITELABEL="wadz_test" CONTRACT="VaultManagerUpgradeable"  FUNCTION_NAME=encodeSetMaxWithdrawalSize MAX_WITHDRAWAL_SIZE="150" hardhat run scripts/EmergencyWithdrawWithMultisig.js --network arbitrumOne
```

3. encodeSetProtocolConfig

```bash
npx cross-env WHITELABEL="wadz_test" CONTRACT="VaultManagerUpgradeable"  FUNCTION_NAME=encodeSetProtocolConfig hardhat run scripts/EmergencyWithdrawWithMultisig.js --network arbitrumOne   
```

4. encodeSetProtocolConfig 

```bash
npx cross-env WHITELABEL="wadz_test" CONTRACT="VaultManagerUpgradeable"  FUNCTION_NAME=encodeSetProtocolConfig NEW_PROTOCOL_CONFIG_ADDRESS="0x9366E6BE677858047d2AC2C0c173C076134aca2A" hardhat run scripts/EmergencyWithdrawWithMultisig.js --network arbitrumOne
```

5. encodeWithdrawCompanyFees

```bash
npx cross-env WHITELABEL="wadz_test" CONTRACT="VaultManagerUpgradeable"  FUNCTION_NAME=encodeWithdrawCompanyFees MASTER_ADMIN_WALLET="0x69531380bf6ffcc7aaa2d3e3e75b98a345bd4c10" hardhat run scripts/EmergencyWithdrawWithMultisig.js --network arbitrumOne
```

6. encodeSetMaxMigrationSize

```bash
npx cross-env WHITELABEL="wadz_test" CONTRACT="VaultManagerUpgradeable"  FUNCTION_NAME=encodeSetMaxMigrationSize NEW_MAX_MIGRATION_SIZE="150" hardhat run scripts/EmergencyWithdrawWithMultisig.js --network arbitrumOne
```

7. encodeSetUserManagerAddress

```bash
npx cross-env WHITELABEL="wadz_test" CONTRACT="VaultManagerUpgradeable"  FUNCTION_NAME=encodeSetUserManagerAddress NEW_USER_MANAGER_ADDRESS="0x69531380bf6ffcc7aaa2d3e3e75b98a345bd4c10" hardhat run scripts/EmergencyWithdrawWithMultisig.js --network arbitrumOne
```

8. encodeSetTokenOracles

```bash
npx cross-env WHITELABEL="wadz_test" CONTRACT="VaultManagerUpgradeable"  FUNCTION_NAME=encodeSetTokenOracles NEW_TOKEN_ORACLES="0x69531380bf6ffcc7aaa2d3e3e75b98a345bd4c10" hardhat run scripts/EmergencyWithdrawWithMultisig.js --network arbitrumOne
```

9. encodeSetTWAPWindow

```bash
npx cross-env WHITELABEL="wadz_test" CONTRACT="VaultManagerUpgradeable"  FUNCTION_NAME=encodeSetTWAPWindow TWAP_WINDOW=150 hardhat run scripts/EmergencyWithdrawWithMultisig.js --network arbitrumOne  
```

10. encodeSetSlippageParameters

```bash
npx cross-env WHITELABEL="wadz_test" CONTRACT="VaultManagerUpgradeable"  FUNCTION_NAME=encodeSetSlippageParameters SLIPPAGE_NUMERATOR=9900 hardhat run scripts/EmergencyWithdrawWithMultisig.js --network arbitrumOne 
```

11. encodeSetAddress
 
```bash
npx cross-env WHITELABEL="wadz_test" CONTRACT="VaultManagerUpgradeable"  FUNCTION_NAME=encodeSetAddress CONFIG_KEY="0xa7338eeee46063bba99c5dc7b227c968f3910c343756d326e0ebb6f25a3270a4" CONFIG_VALUE_ADDRESS="0x82af49447d8a07e3bd95bd0d56f35241523fbab1"  hardhat run scripts/EmergencyWithdrawWithMultisig.js --network arbitrumOne
```

12. encodeSetUint

```bash
npx cross-env WHITELABEL="wadz_test" CONTRACT="VaultManagerUpgradeable"  FUNCTION_NAME=encodeSetUint CONFIG_KEY="0xa7338eeee46063bba99c5dc7b227c968f3910c343756d326e0ebb6f25a3270a4" CONFIG_VALUE_UINT="10"  hardhat run scripts/EmergencyWithdrawWithMultisig.js --network arbitrumOne                   
```

13. encodeSetUserPackage

```bash
npx cross-env WHITELABEL="wadz_test" CONTRACT="VaultManagerUpgradeable"  FUNCTION_NAME=encodeSetUserPackage USER_PACKAGE_USER="0x8921b0563F9a7B186A0db5CeB0CbE8b0a118FBCA" USER_PACKAGE_ID="1"  hardhat run scripts/EmergencyWithdrawWithMultisig.js --network arbitrumOne                               
```

14. encodeSetPackageCap

```bash
npx cross-env WHITELABEL="wadz_test" CONTRACT="VaultManagerUpgradeable"  FUNCTION_NAME=encodeSetPackageCap PACKAGE_CAP_LIQUIDITY="1000000" PACKAGE_CAP_FEE="10000" PACKAGE_CAP_USER_FEE="1000" hardhat run scripts/EmergencyWithdrawWithMultisig.js --network arbitrumOne                                                            
```
15. encodeMigratePositionBatches

```bash
npx cross-env WHITELABEL="wadz" MIGRATE_USERS="user1,user2" MIGRATE_MANAGER="managerAddress" MIGRATE_POOL_ID="poolId" MIGRATE_PACKAGE_IDS="id1,id2" MIGRATE_TICK_LOWER=-100 MIGRATE_TICK_UPPER=100 FUNCTION_NAME=encodeMigratePositionBatches hardhat run scripts/EmergencyWithdrawWithMultisig.js --network arbitrumOne
```