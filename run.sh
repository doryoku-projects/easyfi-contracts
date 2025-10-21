
#!/bin/bash
set -e  # exit on error

echo "🚀 Step 1: Deploy with Factory"
npx hardhat run ./launch/factory.js --network localhost

echo "🚀 Step 2: Deploy with contracts..."
npx cross-env WHITELABEL="easyfi_test" hardhat run ./launch/deployAll.js --network localhost                 

echo "🧪 Step 3: Run role setting updates..."
npx cross-env WHITELABEL="easyfi_test" hardhat test test/Integration/I_rolesetingNuevo.js --network localhost

echo "✅ Done! Contracts upgraded and tested successfully."
