// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// When running the script with `npx hardhat run <script>` you'll find the Hardhat
// Runtime Environment's members available in the global scope.
const { ethers } = require("hardhat");
const hre = require("hardhat");

async function main() {
  // Hardhat always runs the compile task when running scripts with its command
  // line interface.
  //
  // If this script is run directly using `node` you may want to call compile
  // manually to make sure everything is compiled
  // await hre.run('compile');

  // We get the contract to deploy
  const toWei = (num) => ethers.utils.parseEther(num.toString());
  let royaltyFee = toWei(0.01);
  let prices = [toWei(1), toWei(2), toWei(3), toWei(4), toWei(5), toWei(6), toWei(7), toWei(8)];
  let deploymentFees = toWei(prices.length * 0.01);

  [deployer, artist] = await ethers.getSigners();

  console.log("Deploying contracts with the account: ", deployer.address);
  console.log("Account balance: ", (await deployer.getBalance()).toString());

  const NFTMarketplaceFactory = await hre.ethers.getContractFactory("MusicNFTMarketplace");
  const nftMarketplaceFactory = await NFTMarketplaceFactory.deploy(
    artist.address,
    royaltyFee,
    prices,
    { value: deploymentFees }
  );
  await nftMarketplaceFactory.deployed();

  console.log("MusicNFTMarketplace contract deployed to:", nftMarketplaceFactory.address);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
