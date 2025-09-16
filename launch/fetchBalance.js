const { ethers } = require("hardhat");
require("dotenv").config();

async function main() {
  const fundsManagerAddress = process.env.FUNDS_MANAGER_ADDRESS;
  const mainTokenAddress = process.env.MAIN_TOKEN_ADDRESS

  MainToken = await ethers.getContractAt(
    "IERC20",
    mainTokenAddress
  );
  const balance = await MainToken.balanceOf(fundsManagerAddress);

  // USDC has 6 decimals
  console.log(
    "USDC balance of FundsManager:",
    ethers.formatUnits(balance, 6)
  );
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
