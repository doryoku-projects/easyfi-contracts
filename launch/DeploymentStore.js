const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

// const DEPLOYMENTS_DIR = path.join(__dirname, "../deployments");
const DEPLOYMENTS_FILE = path.join(__dirname, "../deployments.json");

/**
 * Reads the entire master deployments file, initializes structures if needed.
 * @returns {Promise<{master: object, chainId: number, network: object}>} Object containing the master deployments, chain ID, and network-specific deployments.
 */
async function _loadAndPrepareDeployments() {
    // Determine the current network's Chain ID
    const network = await ethers.provider.getNetwork();
    const chainId = Number(network.chainId);

    if (!fs.existsSync(DEPLOYMENTS_FILE)) {
        fs.writeFileSync(DEPLOYMENTS_FILE, JSON.stringify({}, null, 2));
    }

    let masterDeployments = {};
    if (fs.existsSync(DEPLOYMENTS_FILE)) {
        try {
            const content = fs.readFileSync(DEPLOYMENTS_FILE, "utf-8");
            masterDeployments = JSON.parse(content);
        } catch (e) {
            console.warn("⚠️ Warning: Could not parse deployments.json. Starting fresh for this run.");
        }
    }

    // Initialize the network object if it doesn't exist (e.g., "11155111": {})
    if (!masterDeployments[chainId]) {
        masterDeployments[chainId] = {};
    }

    return { 
        master: masterDeployments, 
        chainId: chainId, 
        network: masterDeployments[chainId] 
    };
}

/**
 * Stores a contract address under a given name for the currently connected chain.
 * @param {string} contractName - The key (e.g., "UserManagerProxy").
 * @param {string} address - The deployed contract address.
 */
async function storeDeployment(contractName, address) {
    const { master, chainId, network } = await _loadAndPrepareDeployments();

    // Store the new address in the network-specific object
    network[contractName] = address;

    // Write the entire master object back to the file
    fs.writeFileSync(DEPLOYMENTS_FILE, JSON.stringify(master, null, 2));

}

/**
 * Retrieves a contract address by name for the currently connected chain.
 * @param {string} contractName - The key (e.g., "UserManagerProxy").
 * @returns {Promise<string>} The deployed contract address.
 * @throws {Error} If the address is not found.
 */
async function getDeploymentAddress(contractName) {
    const { chainId, network } = await _loadAndPrepareDeployments();
    const address = network[contractName];

    if (!address) {
        throw new Error(`\n❌ Error: Contract '${contractName}' address not found for Chain ID: ${chainId}`);
    }
    return address;
}

module.exports = {
    storeDeployment,
    getDeploymentAddress,
};