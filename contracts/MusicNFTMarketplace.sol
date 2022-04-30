//SPDX-License-Identifier: MIT

pragma solidity ^0.8.10;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC721/ERC721.sol";

contract MusicNFTMarketplace is ERC721("DAppFi", "DAPP"), Ownable {
    string public baseURI = 
        "https://bafybeihhc7y4hail43cif5nh3fkczeuxdfzyxiux6nfp5smpxm4giqgaqi.ipfs.nftstorage.link/";
    string public baseExtension = ".json";
    address public artist;
    uint256 public royaltyFee;

    struct MarketItem {
        uint256 tokenId;
        address payable seller;
        uint256 price;
    }

    MarketItem[] public marketItems;

    event MarketItemBought(
        uint256 indexed tokenId,
        address indexed seller,
        address buyer,
        uint256 price
    );

    event MarketItemRelisted(
        uint256 indexed tokenId,
        address indexed seller,
        uint256 price
    );

    constructor(address _artist, uint256 _royaltyFee, uint256[] memory _prices) payable {
        require(_prices.length * _royaltyFee <= msg.value, "Deployer must pay royalty fee for each token listed on the marketplace");
        artist = _artist;
        royaltyFee = _royaltyFee;

        for (uint8 i = 0; i < _prices.length; i++) {
            require(_prices[i] > 0, "Price must be greater than 0");
            _mint(address(this), i);
            marketItems.push(MarketItem(i, payable(msg.sender), _prices[i]));
        }
    }

    function updateRoyaltyFee(uint256 _royaltyFee) external onlyOwner {
        royaltyFee = _royaltyFee;
    }

    function buyToken(uint256 _tokenId) external payable {
        uint256 price = marketItems[_tokenId].price;
        address seller = marketItems[_tokenId].seller;
        require(msg.value == price, "Please send the correct amount in order to complete the purchase");
        marketItems[_tokenId].seller = payable(address(0));
        _transfer(address(this), msg.sender, _tokenId);
        
        (bool success,) = payable(artist).call{value: royaltyFee}("");
        require(success, "Failed to send Ether");

        (bool success1, ) = payable(seller).call{value: msg.value}("");
        require(success1, "Failed to send Ether");

        emit MarketItemBought(_tokenId, seller, msg.sender, price);
    }

    function resellToken(uint256 _tokenId, uint256 _price) external payable {
        //require(ownerOf(_tokenId) == msg.sender, "You are not the rightful owner");
        require(msg.value == royaltyFee, "Must pay royalty");
        require(_price > 0, "Price must be greater than zero");
        marketItems[_tokenId].price = _price;
        marketItems[_tokenId].seller = payable(msg.sender);

        _transfer(msg.sender, address(this), _tokenId);
        emit MarketItemRelisted(_tokenId, msg.sender, _price);
    }

    function getAllUnsoldTokens() external view returns (MarketItem[] memory) {
        uint256 unsoldCount = balanceOf(address(this));
        MarketItem[] memory tokens = new MarketItem[](unsoldCount);
        uint256 currentIndex;
        for (uint256 i = 0; i < marketItems.length; i++) {
            if (marketItems[i].seller != address(0)) {
                tokens[currentIndex] = marketItems[i];
                currentIndex++;
            }
        }
        return (tokens);
    }

    function getMyTokens() external view returns (MarketItem[] memory) {
        uint256 myTokenCount = balanceOf(msg.sender);
        MarketItem[] memory tokens = new MarketItem[](myTokenCount);
        uint256 currentIndex;
        for (uint256 i = 0; i < marketItems.length; i++) {
            if (ownerOf(i) == msg.sender) {
                tokens[currentIndex] = marketItems[i];
                currentIndex++;
            }
        }
        return (tokens);
    }

    function _baseURI() internal view virtual override returns (string memory) {
        return baseURI;
    }
}