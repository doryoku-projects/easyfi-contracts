var {ethers} = require("ethers");
// RPC endpoint
const RPC_URL = "http://0.0.0.0:8545/";
const provider = new ethers.JsonRpcProvider(RPC_URL);

// Wallet address to check
const address = "0x1033c4b565F19e957f40c2F32270ec8657952511";
let address2 ="0x020eB8739B60c358C4FaBAF111d5B002AC52bDab"


async function main() {

  const balance = await provider.getBalance(address);
  console.log(`Balance of  ${address}: ${ethers.formatEther(balance)} ETH`);
  let balance2 = await provider.getBalance(address2);
  console.log(`Balance of  ${address2}: ${ethers.formatEther(balance2)} ETH`);
}

main().then(() => process.exit(0)).catch((error) => {
  console.error(error);
  process.exit(1);
});
