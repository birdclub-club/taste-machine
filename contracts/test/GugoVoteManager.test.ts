import { expect } from "chai";
import { ethers } from "hardhat";
import { GugoVoteManager } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("GugoVoteManager", function () {
  let voteManager: GugoVoteManager;
  let owner: SignerWithAddress;
  let user1: SignerWithAddress;
  let user2: SignerWithAddress;
  let mockGugoToken: any;

  const INITIAL_ETH_PRICE = ethers.parseUnits("3200", 8); // $3200
  const INITIAL_GUGO_PRICE = ethers.parseUnits("0.01", 8); // $0.01

  beforeEach(async function () {
    // Get signers
    [owner, user1, user2] = await ethers.getSigners();

    // Deploy mock GUGO token
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    mockGugoToken = await MockERC20.deploy("GUGO Token", "GUGO", ethers.parseEther("1000000"));

    // Deploy GugoVoteManager
    const GugoVoteManager = await ethers.getContractFactory("GugoVoteManager");
    voteManager = await GugoVoteManager.deploy(
      await mockGugoToken.getAddress(),
      owner.address, // Price oracle
      INITIAL_ETH_PRICE,
      INITIAL_GUGO_PRICE
    );

    // Give users some GUGO tokens
    await mockGugoToken.transfer(user1.address, ethers.parseEther("1000"));
    await mockGugoToken.transfer(user2.address, ethers.parseEther("1000"));
  });

  describe("Deployment", function () {
    it("Should set the correct initial values", async function () {
      expect(await voteManager.ethPriceUSD()).to.equal(INITIAL_ETH_PRICE);
      expect(await voteManager.gugoPriceUSD()).to.equal(INITIAL_GUGO_PRICE);
      expect(await voteManager.VOTE_PRICE_USD_CENTS()).to.equal(4);
      expect(await voteManager.MINIMUM_VOTES()).to.equal(10);
    });

    it("Should calculate vote costs correctly", async function () {
      const minVotes = await voteManager.MINIMUM_VOTES();
      
      // Calculate expected costs
      // 10 votes * $0.04 = $0.40 = 40 cents
      // ETH cost: 40 cents / $3200 per ETH = 0.000125 ETH
      const expectedEthCost = ethers.parseEther("0.000125");
      
      // GUGO cost: 40 cents / $0.01 per GUGO = 40 GUGO
      const expectedGugoCost = ethers.parseEther("40");

      const ethCost = await voteManager.getVoteCostETH(minVotes);
      const gugoCost = await voteManager.getVoteCostGUGO(minVotes);

      expect(ethCost).to.be.closeTo(expectedEthCost, ethers.parseEther("0.000001"));
      expect(gugoCost).to.be.closeTo(expectedGugoCost, ethers.parseEther("0.1"));
    });
  });

  describe("User Registration", function () {
    it("Should register a new user", async function () {
      await voteManager.connect(user1).registerUser();
      
      const userData = await voteManager.users(user1.address);
      expect(userData.isRegistered).to.be.true;
      expect(userData.xp).to.equal(0);
      expect(userData.totalVotes).to.equal(0);
    });

    it("Should not allow double registration", async function () {
      await voteManager.connect(user1).registerUser();
      
      await expect(
        voteManager.connect(user1).registerUser()
      ).to.be.revertedWith("User already registered");
    });
  });

  describe("Free Votes", function () {
    beforeEach(async function () {
      await voteManager.connect(user1).registerUser();
    });

    it("Should allow claiming daily free votes", async function () {
      await voteManager.connect(user1).claimDailyFreeVotes();
      
      const userData = await voteManager.users(user1.address);
      expect(userData.votesRemaining).to.equal(3);
    });

    it("Should not allow claiming free votes twice in one day", async function () {
      await voteManager.connect(user1).claimDailyFreeVotes();
      
      await expect(
        voteManager.connect(user1).claimDailyFreeVotes()
      ).to.be.revertedWith("Free votes already claimed today");
    });
  });

  describe("Vote Purchasing", function () {
    beforeEach(async function () {
      await voteManager.connect(user1).registerUser();
    });

    it("Should allow purchasing votes with ETH", async function () {
      const voteCount = 10;
      const cost = await voteManager.getVoteCostETH(voteCount);
      
      await voteManager.connect(user1).purchaseVotesWithETH(voteCount, { value: cost });
      
      const userData = await voteManager.users(user1.address);
      expect(userData.votesRemaining).to.equal(voteCount);
    });

    it("Should allow purchasing votes with GUGO", async function () {
      const voteCount = 10;
      const cost = await voteManager.getVoteCostGUGO(voteCount);
      
      // Approve GUGO spending
      await mockGugoToken.connect(user1).approve(await voteManager.getAddress(), cost);
      
      await voteManager.connect(user1).purchaseVotesWithGUGO(voteCount);
      
      const userData = await voteManager.users(user1.address);
      expect(userData.votesRemaining).to.equal(voteCount);
    });

    it("Should reject purchase below minimum votes", async function () {
      const cost = await voteManager.getVoteCostETH(5);
      
      await expect(
        voteManager.connect(user1).purchaseVotesWithETH(5, { value: cost })
      ).to.be.revertedWith("Must buy minimum votes");
    });
  });

  describe("NFT Registration", function () {
    it("Should allow owner to register NFTs", async function () {
      const contractAddr = "0x1234567890123456789012345678901234567890";
      const tokenId = 1;
      const collectionName = "Test Collection";
      const tokenURI = "https://test.com/1";

      await expect(
        voteManager.registerNFT(contractAddr, tokenId, collectionName, tokenURI)
      ).to.emit(voteManager, "NFTRegistered");

      const nftData = await voteManager.nfts(1);
      expect(nftData.contractAddress).to.equal(contractAddr);
      expect(nftData.tokenId).to.equal(tokenId);
      expect(nftData.eloRating).to.equal(1200); // INITIAL_ELO
      expect(nftData.isActive).to.be.true;
    });

    it("Should not allow non-owner to register NFTs", async function () {
      await expect(
        voteManager.connect(user1).registerNFT(
          "0x1234567890123456789012345678901234567890",
          1,
          "Test",
          "https://test.com/1"
        )
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });
  });

  describe("Match Creation and Voting", function () {
    beforeEach(async function () {
      // Register users
      await voteManager.connect(user1).registerUser();
      await voteManager.connect(user2).registerUser();

      // Give users votes
      await voteManager.connect(user1).claimDailyFreeVotes();
      await voteManager.connect(user2).claimDailyFreeVotes();

      // Register two NFTs
      await voteManager.registerNFT(
        "0x1234567890123456789012345678901234567890", 1, "Collection A", "uri1"
      );
      await voteManager.registerNFT(
        "0x1234567890123456789012345678901234567890", 2, "Collection B", "uri2"
      );
    });

    it("Should create a match between two NFTs", async function () {
      await expect(voteManager.createMatch(1, 2))
        .to.emit(voteManager, "MatchCreated")
        .withArgs(1, 1, 2);

      const matchInfo = await voteManager.getMatchInfo(1);
      expect(matchInfo.nftA).to.equal(1);
      expect(matchInfo.nftB).to.equal(2);
      expect(matchInfo.isResolved).to.be.false;
    });

    it("Should allow users to vote on matches", async function () {
      await voteManager.createMatch(1, 2);

      await expect(voteManager.connect(user1).vote(1, 1, 2)) // Vote for NFT A with 2 votes
        .to.emit(voteManager, "VoteCast")
        .withArgs(1, user1.address, 1, 2);

      const matchInfo = await voteManager.getMatchInfo(1);
      expect(matchInfo.votesForA).to.equal(2);
      expect(matchInfo.votesForB).to.equal(0);

      const userData = await voteManager.users(user1.address);
      expect(userData.votesRemaining).to.equal(1); // Had 3, used 2
      expect(userData.totalVotes).to.equal(2);
      expect(userData.xp).to.equal(20); // 2 votes * 10 XP per vote
    });

    it("Should not allow voting with insufficient votes", async function () {
      await voteManager.createMatch(1, 2);

      await expect(
        voteManager.connect(user1).vote(1, 1, 10) // Try to vote with 10 when they only have 3
      ).to.be.revertedWith("Insufficient votes");
    });

    it("Should not allow double voting on same match", async function () {
      await voteManager.createMatch(1, 2);

      await voteManager.connect(user1).vote(1, 1, 1);
      
      await expect(
        voteManager.connect(user1).vote(1, 2, 1)
      ).to.be.revertedWith("Already voted on this match");
    });
  });

  describe("Price Updates", function () {
    it("Should allow price oracle to update prices", async function () {
      const newEthPrice = ethers.parseUnits("3500", 8);
      const newGugoPrice = ethers.parseUnits("0.02", 8);

      await expect(voteManager.updatePrices(newEthPrice, newGugoPrice))
        .to.emit(voteManager, "PricesUpdated")
        .withArgs(newEthPrice, newGugoPrice);

      expect(await voteManager.ethPriceUSD()).to.equal(newEthPrice);
      expect(await voteManager.gugoPriceUSD()).to.equal(newGugoPrice);
    });

    it("Should not allow unauthorized price updates", async function () {
      await expect(
        voteManager.connect(user1).updatePrices(
          ethers.parseUnits("3500", 8),
          ethers.parseUnits("0.02", 8)
        )
      ).to.be.revertedWith("Unauthorized");
    });
  });
});

// Mock ERC20 contract for testing
const mockERC20Source = `
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MockERC20 is ERC20 {
    constructor(string memory name, string memory symbol, uint256 totalSupply) ERC20(name, symbol) {
        _mint(msg.sender, totalSupply);
    }
}
`; 