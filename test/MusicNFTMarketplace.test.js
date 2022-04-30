const { expect } = require("chai");
const { ethers } = require("hardhat");

const toWei = (num) => ethers.utils.parseEther(num.toString());
const fromWei = (num) => ethers.utils.formatEther(num);

describe("MusicNFTMarketplace", () => {

  let nftMarketplace;
  let royaltyFee = toWei(0.01);
  let URI = "https://bafybeihhc7y4hail43cif5nh3fkczeuxdfzyxiux6nfp5smpxm4giqgaqi.ipfs.nftstorage.link/"
  let prices = [toWei(1), toWei(2), toWei(3), toWei(4), toWei(5), toWei(6), toWei(7), toWei(8)];
  //let deploymentFees = toWei(prices.length * 0.01);

  beforeEach(async () => {

    [deployer, artist, account0, account1, ...accounts] = await ethers.getSigners();

    const NFTMarketplaceFactory = await ethers.getContractFactory("MusicNFTMarketplace");
    nftMarketplace = await NFTMarketplaceFactory.deploy(
      artist.address,
      royaltyFee,
      prices,
      { value: toWei(prices.length * 0.01) }
    );
  });

  describe("Deployment", () => {
    
    it("Should track name, symbol, URI, royalty fee and artist", async () => {
      const nftName = "DAppFi";
      const nftSymbol = "DAPP";
      expect(await nftMarketplace.name()).to.eq(nftName);
      expect(await nftMarketplace.symbol()).to.eq(nftSymbol);
      expect(await nftMarketplace.baseURI()).to.eq(URI);
      expect(await nftMarketplace.royaltyFee()).to.eq(royaltyFee);
      expect(await nftMarketplace.artist()).to.eq(artist.address);
    });

    it("Should mint then list all the music nfts", async () => {
      expect(await nftMarketplace.balanceOf(nftMarketplace.address)).to.eq(8);
      // Get each item from the marketItems array then check fields to ensure they are correct
      await Promise.all(prices.map(async (i, indx) => {
        const item = await nftMarketplace.marketItems(indx);
        expect(item.tokenId).to.eq(indx);
        expect(item.seller).to.eq(deployer.address);
        expect(item.price).to.eq(i);
      }));
    });

    it("Ether balance should equal deployment fees", async () => {
      expect(await ethers.provider.getBalance(nftMarketplace.address)).to.eq(toWei(prices.length * 0.01));
    });

  });
  
  describe("Updating royalty fee", () => {

    it("Only deployer should be able to update royalty fee", async () => {
      const fee = toWei(0.02);
      await nftMarketplace.updateRoyaltyFee(fee);
      await expect(nftMarketplace.connect(account0).updateRoyaltyFee(toWei(0.05)))
        .to.be.revertedWith("Ownable: caller is not the owner");
      expect(await nftMarketplace.royaltyFee()).to.eq(fee);
    });

  });

  describe("Buying tokens", () => {
    it("Should update seller to zero address, transferNFT, pay seller, pay royalty to artist and emit a MarketItemBought event", async () => {
      const deployerInitialEthBal= await deployer.getBalance();
      const artistInitialEthBal = await artist.getBalance();

      await expect(nftMarketplace.connect(account0).buyToken(0, { value: prices[0] }))
        .to.emit(nftMarketplace, "MarketItemBought")
        .withArgs(
          0,
          deployer.address,
          account0.address,
          prices[0]
        );
      
      const deployerFinalEthBal = await deployer.getBalance();
      const artistFinalEthBal = await artist.getBalance();

      expect((await nftMarketplace.marketItems(0)).seller).to.eq("0x0000000000000000000000000000000000000000");
      expect(+fromWei(deployerFinalEthBal)).to.eq(+fromWei(prices[0]) + +fromWei(deployerInitialEthBal));
      expect(+fromWei(artistFinalEthBal)).to.eq(+fromWei(royaltyFee) + +fromWei(artistInitialEthBal));
      expect(await nftMarketplace.ownerOf(0)).to.eq(account0.address);
    });

    it("Should fail when ether amount sent with transaction does not equal asking price", async () => {
      await expect(nftMarketplace.connect(account1).buyToken(0, { value: toWei(0.05) }))
        .to.be.revertedWith("Please send the correct amount in order to complete the purchase");
    });
  });

  describe("Reselling tokens", () => {
    beforeEach(async () => {
      await nftMarketplace.connect(account0).buyToken(0, { value: prices[0] });
    });

    it("Should track resale item, increase ether balance by royalty fee, transfer NFT to marketplace, and emit MarketItemRelisted event", async () => {
      const resaleprice = toWei(2);
      const initialMarketBal = await ethers.provider.getBalance(nftMarketplace.address);

      await expect(nftMarketplace.connect(account0).resellToken(0, resaleprice, { value: royaltyFee }))
        .to.emit(nftMarketplace, "MarketItemRelisted")
        .withArgs(
          0,
          account0.address,
          resaleprice
        );

      const finalMarketBal = await ethers.provider.getBalance(nftMarketplace.address);
      expect(+fromWei(finalMarketBal)).to.eq(+fromWei(royaltyFee) + +fromWei(initialMarketBal));
      expect(await nftMarketplace.ownerOf(0)).to.eq(nftMarketplace.address);
      const item = await nftMarketplace.marketItems(0);
      expect(item.tokenId).to.eq(0);
      expect(item.seller).to.eq(account0.address);
      expect(item.price).to.eq(toWei(2));
    });

    it("Should fail if price is set to zero and royalty fee is not paid", async () => {
      await expect(nftMarketplace.connect(account0).resellToken(0, toWei(0), { value: royaltyFee }))
        .to.be.revertedWith("Price must be greater than zero");
      await expect(nftMarketplace.connect(account0).resellToken(0, toWei(1), { value: 0 }))
        .to.be.revertedWith("Must pay royalty");
    });
  });

  describe("Getter functions", () => {
    let soldItems = [0, 1, 4];
    let ownedByAccount0 = [0, 1];
    let ownedByAccount1 = [4];

    beforeEach(async () => {
      await nftMarketplace.connect(account0).buyToken(0, { value: prices[0] });
      await nftMarketplace.connect(account0).buyToken(1, { value: prices[1] });
      await nftMarketplace.connect(account1).buyToken(4, { value: prices[4] });
    });

    it("getAllUnsoldTokens should fetch all the marketplace items still up for sale", async () => {
      const unsoldItems = await nftMarketplace.getAllUnsoldTokens();
      // Check to make sure that all the returned unsoldItems have filtered out the sold items
      expect(unsoldItems.every(i => !soldItems.some(j => j === i.tokenId.toNumber()))).to.eq(true);
      expect(unsoldItems.length === prices.length - soldItems.length).to.eq(true);
    });

    it("getMyTokens should fetch all tokens the user owns", async () => {
      let myItems = await nftMarketplace.connect(account0).getMyTokens();

      expect(myItems.every(i => ownedByAccount0.some(j => j === i.tokenId.toNumber()))).to.eq(true);
      expect(ownedByAccount0.length === myItems.length).to.eq(true);

      myItems = await nftMarketplace.connect(account1).getMyTokens();

      expect(myItems.every(i => ownedByAccount1.some(j => j === i.tokenId.toNumber()))).to.eq(true);
      expect(ownedByAccount1.length === myItems.length).to.eq(true);
    });
  });
});