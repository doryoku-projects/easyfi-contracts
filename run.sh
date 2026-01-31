
#!/bin/bash
set -e  # exit on error

# echo "🚀 Step 1: Deploy with Factory"
# npx hardhat run ./launch/factory.js --network localhost

echo "🚀 Step 2: Deploy with contracts..."
npx cross-env WHITELABEL="wadz" hardhat run ./launch/deployAll.js --network base                 

echo "🚀 Step 2.1: Deploy VaultV2 contracts..."
npx cross-env WHITELABEL="wadz" hardhat run ./launch/deployAllVaultV2.js --network base

echo "🧪 Step 3: Run role setting updates..."
npx cross-env WHITELABEL="wadz" hardhat test test/Integration/I_rolesetingNuevo.js --network base

echo "✅ Done! Contracts Deployed and tested successfully."