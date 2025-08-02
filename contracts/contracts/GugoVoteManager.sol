// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

/**
 * @title GugoVoteManager
 * @dev Core contract for "Taste Machine" NFT aesthetic voting game
 * Handles voting mechanics, Elo ratings, XP rewards, and payments
 */
contract GugoVoteManager is Ownable, ReentrancyGuard, Pausable {
    
    // Game constants
    uint256 public constant VOTE_PRICE_USD_CENTS = 4; // $0.04 USD per vote
    uint256 public constant MINIMUM_VOTES = 10; // Minimum purchase
    uint256 public constant DAILY_FREE_VOTES = 3; // Free votes per day
    uint256 public constant XP_PER_VOTE = 10; // XP gained per vote
    uint256 public constant XP_WIN_BONUS = 25; // Extra XP for picking winner
    
    // Elo rating constants
    uint256 public constant INITIAL_ELO = 1200;
    uint256 public constant K_FACTOR = 32; // Elo adjustment factor
    
    // Payment tokens
    IERC20 public gugoToken;
    address public priceOracle; // For ETH/USD and GUGO/USD rates
    
    // Game state
    struct NFTData {
        address contractAddress;
        uint256 tokenId;
        uint256 eloRating;
        uint256 totalVotes;
        uint256 wins;
        uint256 losses;
        bool isActive;
        string collectionName;
        string tokenURI;
    }
    
    struct User {
        uint256 xp;
        uint256 totalVotes;
        uint256 wins;
        uint256 losses;
        uint256 streak;
        uint256 lastFreeVoteClaim;
        uint256 votesRemaining;
        bool isRegistered;
    }
    
    struct VoteMatch {
        uint256 nftA;
        uint256 nftB;
        uint256 votesForA;
        uint256 votesForB;
        uint256 endTime;
        bool isResolved;
        uint256 winner; // 0 = tie, 1 = A wins, 2 = B wins
        mapping(address => uint256) userVotes; // user => (1 for A, 2 for B)
    }
    
    // Storage
    mapping(uint256 => NFTData) public nfts; // nftId => NFTData
    mapping(address => User) public users;
    mapping(uint256 => VoteMatch) public matches; // matchId => VoteMatch
    mapping(bytes32 => uint256) public nftIdByContract; // keccak256(contract, tokenId) => nftId
    
    uint256 public nextNFTId = 1;
    uint256 public nextMatchId = 1;
    uint256 public activeMatches = 0;
    
    // Price tracking
    uint256 public ethPriceUSD; // USD price * 1e8 (like Chainlink)
    uint256 public gugoPriceUSD; // USD price * 1e8
    uint256 public lastPriceUpdate;
    
    // Events
    event NFTRegistered(uint256 indexed nftId, address indexed contractAddr, uint256 indexed tokenId);
    event MatchCreated(uint256 indexed matchId, uint256 indexed nftA, uint256 indexed nftB);
    event VoteCast(uint256 indexed matchId, address indexed voter, uint256 choice, uint256 amount);
    event MatchResolved(uint256 indexed matchId, uint256 winner, uint256 votesA, uint256 votesB);
    event EloUpdated(uint256 indexed nftId, uint256 oldElo, uint256 newElo);
    event UserXPGained(address indexed user, uint256 amount, string reason);
    event VotesPurchased(address indexed user, uint256 amount, uint256 cost, string currency);
    event PricesUpdated(uint256 ethPrice, uint256 gugoPrice);
    
    constructor(
        address _gugoToken,
        address _priceOracle,
        uint256 _initialEthPrice,
        uint256 _initialGugoPrice
    ) Ownable(msg.sender) {
        gugoToken = IERC20(_gugoToken);
        priceOracle = _priceOracle;
        ethPriceUSD = _initialEthPrice;
        gugoPriceUSD = _initialGugoPrice;
        lastPriceUpdate = block.timestamp;
    }
    
    // ============ USER MANAGEMENT ============
    
    function registerUser() external {
        require(!users[msg.sender].isRegistered, "User already registered");
        
        users[msg.sender] = User({
            xp: 0,
            totalVotes: 0,
            wins: 0,
            losses: 0,
            streak: 0,
            lastFreeVoteClaim: 0,
            votesRemaining: 0,
            isRegistered: true
        });
    }
    
    function claimDailyFreeVotes() external {
        User storage user = users[msg.sender];
        require(user.isRegistered, "User not registered");
        require(
            block.timestamp >= user.lastFreeVoteClaim + 1 days,
            "Free votes already claimed today"
        );
        
        user.lastFreeVoteClaim = block.timestamp;
        user.votesRemaining += DAILY_FREE_VOTES;
        
        emit UserXPGained(msg.sender, 0, "Daily free votes claimed");
    }
    
    // ============ VOTE PURCHASING ============
    
    function purchaseVotesWithETH(uint256 voteCount) external payable nonReentrant {
        require(voteCount >= MINIMUM_VOTES, "Must buy minimum votes");
        
        uint256 costUSD = voteCount * VOTE_PRICE_USD_CENTS; // USD cents
        uint256 costETH = (costUSD * 1e18) / (ethPriceUSD / 1e6); // Convert to ETH
        
        require(msg.value >= costETH, "Insufficient ETH");
        
        users[msg.sender].votesRemaining += voteCount;
        
        // Refund excess
        if (msg.value > costETH) {
            payable(msg.sender).transfer(msg.value - costETH);
        }
        
        emit VotesPurchased(msg.sender, voteCount, costETH, "ETH");
    }
    
    function purchaseVotesWithGUGO(uint256 voteCount) external nonReentrant {
        require(voteCount >= MINIMUM_VOTES, "Must buy minimum votes");
        
        uint256 costUSD = voteCount * VOTE_PRICE_USD_CENTS; // USD cents
        uint256 costGUGO = (costUSD * 1e18) / (gugoPriceUSD / 1e6); // Convert to GUGO tokens
        
        require(
            gugoToken.transferFrom(msg.sender, address(this), costGUGO),
            "GUGO transfer failed"
        );
        
        users[msg.sender].votesRemaining += voteCount;
        
        emit VotesPurchased(msg.sender, voteCount, costGUGO, "GUGO");
    }
    
    // ============ NFT MANAGEMENT ============
    
    function registerNFT(
        address contractAddr,
        uint256 tokenId,
        string calldata collectionName,
        string calldata tokenURI
    ) external onlyOwner returns (uint256) {
        bytes32 key = keccak256(abi.encodePacked(contractAddr, tokenId));
        require(nftIdByContract[key] == 0, "NFT already registered");
        
        uint256 nftId = nextNFTId++;
        nftIdByContract[key] = nftId;
        
        nfts[nftId] = NFTData({
            contractAddress: contractAddr,
            tokenId: tokenId,
            eloRating: INITIAL_ELO,
            totalVotes: 0,
            wins: 0,
            losses: 0,
            isActive: true,
            collectionName: collectionName,
            tokenURI: tokenURI
        });
        
        emit NFTRegistered(nftId, contractAddr, tokenId);
        return nftId;
    }
    
    // ============ MATCH MANAGEMENT ============
    
    function createMatch(uint256 nftA, uint256 nftB) external onlyOwner returns (uint256) {
        require(nfts[nftA].isActive && nfts[nftB].isActive, "NFTs must be active");
        require(nftA != nftB, "Cannot match NFT with itself");
        
        uint256 matchId = nextMatchId++;
        VoteMatch storage newMatch = matches[matchId];
        newMatch.nftA = nftA;
        newMatch.nftB = nftB;
        newMatch.endTime = block.timestamp + 24 hours; // 24 hour voting period
        newMatch.isResolved = false;
        
        activeMatches++;
        
        emit MatchCreated(matchId, nftA, nftB);
        return matchId;
    }
    
    function vote(uint256 matchId, uint256 choice, uint256 voteAmount) external whenNotPaused {
        VoteMatch storage match_ = matches[matchId];
        User storage user = users[msg.sender];
        
        require(match_.endTime > block.timestamp, "Voting period ended");
        require(!match_.isResolved, "Match already resolved");
        require(choice == 1 || choice == 2, "Invalid choice");
        require(voteAmount > 0, "Must vote at least 1");
        require(user.votesRemaining >= voteAmount, "Insufficient votes");
        require(match_.userVotes[msg.sender] == 0, "Already voted on this match");
        
        // Record vote
        match_.userVotes[msg.sender] = choice;
        user.votesRemaining -= voteAmount;
        user.totalVotes += voteAmount;
        
        if (choice == 1) {
            match_.votesForA += voteAmount;
        } else {
            match_.votesForB += voteAmount;
        }
        
        // Award XP for voting
        uint256 xpGain = voteAmount * XP_PER_VOTE;
        user.xp += xpGain;
        
        emit VoteCast(matchId, msg.sender, choice, voteAmount);
        emit UserXPGained(msg.sender, xpGain, "Vote cast");
    }
    
    function resolveMatch(uint256 matchId) external {
        VoteMatch storage match_ = matches[matchId];
        require(block.timestamp >= match_.endTime, "Voting period not ended");
        require(!match_.isResolved, "Match already resolved");
        
        uint256 winner;
        if (match_.votesForA > match_.votesForB) {
            winner = 1; // NFT A wins
            nfts[match_.nftA].wins++;
            nfts[match_.nftB].losses++;
        } else if (match_.votesForB > match_.votesForA) {
            winner = 2; // NFT B wins
            nfts[match_.nftB].wins++;
            nfts[match_.nftA].losses++;
        } else {
            winner = 0; // Tie
        }
        
        match_.winner = winner;
        match_.isResolved = true;
        activeMatches--;
        
        // Update Elo ratings
        _updateEloRatings(match_.nftA, match_.nftB, winner);
        
        // Update NFT vote counts
        nfts[match_.nftA].totalVotes += match_.votesForA;
        nfts[match_.nftB].totalVotes += match_.votesForB;
        
        emit MatchResolved(matchId, winner, match_.votesForA, match_.votesForB);
        
        // Award bonus XP to winning voters
        _awardWinnerBonuses(matchId, winner);
    }
    
    function _updateEloRatings(uint256 nftA, uint256 nftB, uint256 winner) internal {
        uint256 ratingA = nfts[nftA].eloRating;
        uint256 ratingB = nfts[nftB].eloRating;
        
        // Calculate expected scores (0-1 scale, multiplied by 1000 for precision)
        uint256 expectedA = _calculateExpectedScore(ratingA, ratingB);
        uint256 expectedB = 1000 - expectedA;
        
        // Actual scores based on winner
        uint256 actualA = winner == 1 ? 1000 : (winner == 0 ? 500 : 0);
        uint256 actualB = winner == 2 ? 1000 : (winner == 0 ? 500 : 0);
        
        // Update ratings
        uint256 newRatingA = ratingA + (K_FACTOR * (actualA - expectedA)) / 1000;
        uint256 newRatingB = ratingB + (K_FACTOR * (actualB - expectedB)) / 1000;
        
        // Ensure ratings don't go below minimum
        newRatingA = newRatingA < 100 ? 100 : newRatingA;
        newRatingB = newRatingB < 100 ? 100 : newRatingB;
        
        emit EloUpdated(nftA, ratingA, newRatingA);
        emit EloUpdated(nftB, ratingB, newRatingB);
        
        nfts[nftA].eloRating = newRatingA;
        nfts[nftB].eloRating = newRatingB;
    }
    
    function _calculateExpectedScore(uint256 ratingA, uint256 ratingB) internal pure returns (uint256) {
        // Simplified Elo expected score calculation
        // Returns value from 0-1000 (representing 0.0-1.0)
        if (ratingA >= ratingB) {
            uint256 diff = ratingA - ratingB;
            if (diff >= 400) return 900; // Cap at 0.9
            return 500 + (diff * 400) / 800; // Linear approximation
        } else {
            uint256 diff = ratingB - ratingA;
            if (diff >= 400) return 100; // Cap at 0.1
            return 500 - (diff * 400) / 800; // Linear approximation
        }
    }
    
    function _awardWinnerBonuses(uint256 matchId, uint256 winner) internal {
        // This would iterate through all voters and award bonuses to winners
        // Implementation would require additional storage to track all voters
        // For now, we'll emit an event and handle bonuses in a separate function
    }
    
    // ============ PRICE MANAGEMENT ============
    
    function updatePrices(uint256 newEthPrice, uint256 newGugoPrice) external {
        require(msg.sender == priceOracle || msg.sender == owner(), "Unauthorized");
        
        ethPriceUSD = newEthPrice;
        gugoPriceUSD = newGugoPrice;
        lastPriceUpdate = block.timestamp;
        
        emit PricesUpdated(newEthPrice, newGugoPrice);
    }
    
    // ============ VIEW FUNCTIONS ============
    
    function getVoteCostETH(uint256 voteCount) external view returns (uint256) {
        uint256 costUSD = voteCount * VOTE_PRICE_USD_CENTS;
        return (costUSD * 1e18) / (ethPriceUSD / 1e6);
    }
    
    function getVoteCostGUGO(uint256 voteCount) external view returns (uint256) {
        uint256 costUSD = voteCount * VOTE_PRICE_USD_CENTS;
        return (costUSD * 1e18) / (gugoPriceUSD / 1e6);
    }
    
    function getUserVoteForMatch(uint256 matchId, address user) external view returns (uint256) {
        return matches[matchId].userVotes[user];
    }
    
    function canClaimFreeVotes(address user) external view returns (bool) {
        return block.timestamp >= users[user].lastFreeVoteClaim + 1 days;
    }
    
    function getMatchInfo(uint256 matchId) external view returns (
        uint256 nftA,
        uint256 nftB,
        uint256 votesForA,
        uint256 votesForB,
        uint256 endTime,
        bool isResolved,
        uint256 winner
    ) {
        VoteMatch storage match_ = matches[matchId];
        return (
            match_.nftA,
            match_.nftB,
            match_.votesForA,
            match_.votesForB,
            match_.endTime,
            match_.isResolved,
            match_.winner
        );
    }
    
    // ============ ADMIN FUNCTIONS ============
    
    function pause() external onlyOwner {
        _pause();
    }
    
    function unpause() external onlyOwner {
        _unpause();
    }
    
    function withdrawETH() external onlyOwner {
        payable(owner()).transfer(address(this).balance);
    }
    
    function withdrawGUGO() external onlyOwner {
        gugoToken.transfer(owner(), gugoToken.balanceOf(address(this)));
    }
    
    function updatePriceOracle(address newOracle) external onlyOwner {
        priceOracle = newOracle;
    }
} 