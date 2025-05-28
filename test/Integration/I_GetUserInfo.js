const { expect } = require("chai");
const { ethers } = require("hardhat");
require("dotenv").config();

describe("I_MigrateBatches via Aggregator", function () {
  let Aggregator, userWallet, marcWallet, aggregatorAddress;  
  aggregatorAddress = process.env.AGGREGATOR_ADDRESS;
  const poolId = "ui-232-122";
  
  before(async function () {
    userWallet = new ethers.Wallet(
      process.env.USER_PRIVATE_KEY,
      ethers.provider
    );
    marcWallet = new ethers.Wallet(
      process.env.MARC_PRIVATE_KEY,
      ethers.provider
    );


    Aggregator = await ethers.getContractAt(
      "AggregatorUpgradeable",
      aggregatorAddress,
      marcWallet
    );

  });

  it("should get user info", async function () {
    

      const info = await Aggregator.getUserInfo(
        userWallet.address,
        poolId);
        console.log("User info :", info);
    });
  });
