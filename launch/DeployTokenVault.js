const deployTokenVault = require("./TokenVault");

async function main() {
    await deployTokenVault();
}

main().catch(console.error);