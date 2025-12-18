const deployTWAPOracle = require("./TWAPOracle");

async function main() {
    console.log("🚀 Starting standalone Library deployment...");
    const libraryAddress = await deployTWAPOracle();
    console.log(`✅ Library successfully deployed at: ${libraryAddress}`);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
