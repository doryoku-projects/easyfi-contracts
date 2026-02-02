
#!/bin/bash
set -e  # exit on error

echo "🚀 Step 1: Deploy VaultV2 contracts..."
npx cross-env WHITELABEL="wadz" hardhat run ./launch/deployAllVaultV2.js --network base

echo "🧪 Step 2: Run VaultV2 setup script..."
npx cross-env WHITELABEL="wadz" hardhat run ./scripts/VaultV2Setup.js --network base

echo "✅ Done! VaultV2 Contracts Deployed and Setup successfully."
