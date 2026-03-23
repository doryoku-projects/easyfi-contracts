
#!/bin/bash
set -e  # exit on error

# echo "🚀 Step 1: Deploy VaultV2 contracts..."
# npx cross-env WHITELABEL="wadz" hardhat run ./launch/deployAllVaultV2.js --network base

# echo "🧪 Step 2: Run VaultV2 setup script..."
# npx cross-env WHITELABEL="wadz" hardhat run ./scripts/VaultV2Setup.js --network arbitrumOne

# echo "✅ Done! VaultV2 Contracts Deployed and Setup successfully."


# echo "🚀 Step 3: run test script..."
# npx cross-env WHITELABEL="wadz_vault" hardhat test test/Integration/I_TokenVault.js --network localhost


# echo "🚀 Step 4: Upgrade Vault V2..."
# npx cross-env WHITELABEL="wadz" hardhat run ./launch/upgrade/vaultV2/TokenVault.js --network base


# echo "🚀 Step 5: Migrate Vault V2..."
##  ## for BASE acc to block range
# WHITELABEL=wadz MIGRATION_DRY_RUN=true LEGACY_VAULT_DEPLOY_BLOCK=41745534 LEGACY_VAULT_END_BLOCK=41750540 LEGACY_VAULT_ADDRESS=0xDC47a90A918e85517d5d35460530191042a6Ff33 npx hardhat run scripts/vaultBatchMigrate.js --network base 


## ##  for ARB acc to block range
# WHITELABEL=wadz_test2 MIGRATION_DRY_RUN=false LEGACY_VAULT_DEPLOY_BLOCK=428853613 LEGACY_VAULT_END_BLOCK=430682459 LEGACY_VAULT_ADDRESS=0xDC47a90A918e85517d5d35460530191042a6Ff33 npx hardhat run scripts/vaultBatchMigrate.js --network localhost 


# 0x3270Fa1E90d54b24b6e0EFF8C9Fb7001acbBCE7B