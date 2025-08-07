
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title GugoVoteManager - "Taste Machine" NFT Aesthetic Voting
 * @dev Simplified on-chain vote tracking with XP and Elo systems
 */
contract GugoVoteManager is Ownable, ReentrancyGuard {
    
    // ============ CORE DATA STRUCTURES ============
    
    struct User {
        uint256 xp;                    // Total XP earned from prize breaks
        uint256 totalVotes;            // Total votes cast
        uint256 winningVotes;          // Votes for eventual winners
        uint256 streak;                // Current winning streak
        uint256 lastVoteTimestamp;     // Last vote time
        uint256 pendingXP;             // XP waiting for next prize break
        uint256 votesRemaining;        // Bonus votes from prize breaks
        uint256 lastPrizeBreak;        // Vote count at last prize break claim
        bool isRegistered;             // Registration status
    }
    
    struct NFT {
        uint256 eloRating;             // Current Elo rating (starts at 1200)
        uint256 totalVotes;            // Total votes received
        uint256 wins;                  // Times this NFT won matchups
        uint256 losses;                // Times this NFT lost matchups
        bool isActive;                 // Whether NFT can be voted on
    }
    
    struct Vote {
        address voter;                 // Who voted
        bytes32 matchupId;             // Frontend matchup identifier
        uint256 winnerTokenId;         // Token that won the vote
        uint256 loserTokenId;          // Token that lost the vote
        bool isSuperVote;              // Whether this was a premium vote
        uint256 timestamp;             // When vote was cast
        uint256 xpValue;               // XP value of this vote (1 or 10)
    }
    
    // ============ STORAGE ============
    
    mapping(address => User) public users;
    mapping(uint256 => NFT) public nfts;              // tokenId => NFT data
    mapping(bytes32 => Vote) public votes;            // voteId => Vote data
    mapping(address => mapping(bytes32 => bool)) public hasVotedInMatchup;
    
    uint256 public totalVotes;
    uint256 public constant INITIAL_ELO = 1200;
    uint256 public constant K_FACTOR = 32;            // Elo adjustment factor
    uint256 public constant PRIZE_BREAK_THRESHOLD = 10; // Prize break every 10 votes
    uint256 public constant BASE_XP_PER_VOTE = 1;     // 1 XP per regular vote
    uint256 public constant SUPER_VOTE_XP = 10;       // 10 XP per super vote
    
    // Prize Break Reward System
    enum RewardType { BASE_XP, BIG_XP, XP_VOTES_10, XP_VOTES_5, VOTE_BONUS, GUGO_TIER_1, GUGO_TIER_2, GUGO_TIER_3, GUGO_TIER_4, GUGO_TIER_5, GUGO_TIER_6, GUGO_TIER_7, GUGO_TIER_8, GUGO_TIER_9 }
    
    struct PrizeBreakReward {
        RewardType rewardType;
        uint256 xpAmount;
        uint256 votesAmount;
        uint256 gugoAmount;
        uint256 timestamp;
    }
    
    // Multi-Treasury System (Rule of Thirds Model)
    uint256 public prizeBreakTreasury;               // 23.33% - Daily prize breaks
    uint256 public weeklyRaffleTreasury;             // 10.00% - Weekly big prizes
    address public operationsWallet;                // 33.33% - All business expenses
    address public constant BURN_WALLET = 0x000000000000000000000000000000000000dEaD; // 33.33% - Token burn
    
    // Legacy treasury (for migration)
    uint256 public legacyTreasury;                   // Old single treasury for migration
    uint256 public baseXPAmount = 10;                // Base XP reward amount
    mapping(address => PrizeBreakReward[]) public userRewardHistory;
    
    // ============ EVENTS ============
    
    event VoteCast(
        address indexed voter,
        bytes32 indexed matchupId,
        uint256 indexed winnerTokenId,
        uint256 loserTokenId,
        bool isSuperVote,
        uint256 xpValue
    );
    
    event EloUpdated(
        uint256 indexed tokenId,
        uint256 oldRating,
        uint256 newRating
    );
    
    event PrizeBreakClaimed(
        address indexed user,
        RewardType indexed rewardType,
        uint256 xpAwarded,
        uint256 votesAwarded,
        uint256 gugoAwarded,
        uint256 newTotalXP
    );
    
    event TreasuryUpdated(
        uint256 newBalance,
        uint256 tiersUnlocked
    );
    
    event RevenueDistributed(
        uint256 totalAmount,
        uint256 burnAmount,
        uint256 prizeBreakAmount,
        uint256 weeklyRaffleAmount,
        uint256 operationsAmount
    );
    
    event TreasuryDeposit(
        string indexed treasuryType,
        uint256 amount,
        uint256 newBalance
    );
    
    event NFTRegistered(
        uint256 indexed tokenId,
        uint256 initialElo
    );
    
    // ============ CONSTRUCTOR ============
    
    constructor() Ownable(msg.sender) {
        // Initialize with owner
        // Treasuries start at 0 and are funded through revenue distribution
    }
    
    function setOperationsWallet(address _operationsWallet) external onlyOwner {
        require(_operationsWallet != address(0), "Invalid operations wallet");
        operationsWallet = _operationsWallet;
    }
    
    // ============ USER MANAGEMENT ============
    
    function registerUser() external {
        require(!users[msg.sender].isRegistered, "Already registered");
        
        users[msg.sender] = User({
            xp: 0,
            totalVotes: 0,
            winningVotes: 0,
            streak: 0,
            lastVoteTimestamp: 0,
            pendingXP: 0,
            votesRemaining: 0,
            lastPrizeBreak: 0,
            isRegistered: true
        });
    }
    
    // ============ NFT MANAGEMENT ============
    
    function registerNFT(uint256 tokenId) external onlyOwner {
        require(nfts[tokenId].eloRating == 0, "NFT already registered");
        
        nfts[tokenId] = NFT({
            eloRating: INITIAL_ELO,
            totalVotes: 0,
            wins: 0,
            losses: 0,
            isActive: true
        });
        
        emit NFTRegistered(tokenId, INITIAL_ELO);
    }
    
    function batchRegisterNFTs(uint256[] calldata tokenIds) external onlyOwner {
        for (uint256 i = 0; i < tokenIds.length; i++) {
            uint256 tokenId = tokenIds[i];
            if (nfts[tokenId].eloRating == 0) {
                nfts[tokenId] = NFT({
                    eloRating: INITIAL_ELO,
                    totalVotes: 0,
                    wins: 0,
                    losses: 0,
                    isActive: true
                });
                emit NFTRegistered(tokenId, INITIAL_ELO);
            }
        }
    }
    
    // ============ VOTING FUNCTIONS ============
    
    function vote(
        bytes32 matchupId,
        uint256 winnerTokenId,
        uint256 loserTokenId
    ) external {
        _castVote(matchupId, winnerTokenId, loserTokenId, false);
    }
    
    function superVote(
        bytes32 matchupId,
        uint256 winnerTokenId,
        uint256 loserTokenId
    ) external {
        _castVote(matchupId, winnerTokenId, loserTokenId, true);
    }
    
    function _castVote(
        bytes32 matchupId,
        uint256 winnerTokenId,
        uint256 loserTokenId,
        bool isSuperVote
    ) internal nonReentrant {
        require(winnerTokenId != loserTokenId, "Cannot vote for same NFT");
        require(!hasVotedInMatchup[msg.sender][matchupId], "Already voted in this matchup");
        require(nfts[winnerTokenId].isActive, "Winner NFT not active");
        require(nfts[loserTokenId].isActive, "Loser NFT not active");
        
        // Auto-register user if needed
        if (!users[msg.sender].isRegistered) {
            users[msg.sender] = User({
                xp: 0,
                totalVotes: 0,
                winningVotes: 0,
                streak: 0,
                lastVoteTimestamp: 0,
                pendingXP: 0,
                votesRemaining: 0,
                lastPrizeBreak: 0,
                isRegistered: true
            });
        }
        
        // Mark that user has voted in this matchup
        hasVotedInMatchup[msg.sender][matchupId] = true;
        
        // Calculate XP value for this vote
        uint256 xpValue = isSuperVote ? SUPER_VOTE_XP : BASE_XP_PER_VOTE;
        
        // Update user stats
        users[msg.sender].totalVotes++;
        users[msg.sender].pendingXP += xpValue;
        users[msg.sender].lastVoteTimestamp = block.timestamp;
        
        // Update NFT stats
        nfts[winnerTokenId].totalVotes++;
        nfts[winnerTokenId].wins++;
        nfts[loserTokenId].totalVotes++;
        nfts[loserTokenId].losses++;
        
        // Update Elo ratings
        _updateEloRatings(winnerTokenId, loserTokenId);
        
        // Create vote record
        bytes32 voteId = keccak256(abi.encodePacked(msg.sender, matchupId, block.timestamp));
        votes[voteId] = Vote({
            voter: msg.sender,
            matchupId: matchupId,
            winnerTokenId: winnerTokenId,
            loserTokenId: loserTokenId,
            isSuperVote: isSuperVote,
            timestamp: block.timestamp,
            xpValue: xpValue
        });
        
        totalVotes++;
        
        emit VoteCast(msg.sender, matchupId, winnerTokenId, loserTokenId, isSuperVote, xpValue);
    }
    
    // ============ PRIZE BREAK LOTTERY SYSTEM ============
    
    function claimPrizeBreak() external {
        User storage user = users[msg.sender];
        require(user.isRegistered, "User not registered");
        
        // Calculate how many prize breaks are available
        uint256 votesEligibleForPrizeBreaks = user.totalVotes - user.lastPrizeBreak;
        require(votesEligibleForPrizeBreaks >= PRIZE_BREAK_THRESHOLD, "Not enough votes for prize break");
        
        // Calculate how many complete prize breaks can be claimed
        uint256 prizeBreaksToAward = votesEligibleForPrizeBreaks / PRIZE_BREAK_THRESHOLD;
        uint256 votesUsedForPrizeBreaks = prizeBreaksToAward * PRIZE_BREAK_THRESHOLD;
        
        // Process each prize break (in case of multiple)
        for (uint256 i = 0; i < prizeBreaksToAward; i++) {
            _processPrizeBreakReward(user);
        }
        
        user.lastPrizeBreak += votesUsedForPrizeBreaks;
    }
    
    function _processPrizeBreakReward(User storage user) internal {
        // Generate pseudo-random number for lottery
        uint256 randomSeed = uint256(keccak256(abi.encodePacked(
            block.timestamp,
            block.difficulty,
            msg.sender,
            user.totalVotes,
            totalVotes
        )));
        
        uint256 roll = randomSeed % 100; // 0-99 for percentage-based odds
        
        RewardType rewardType;
        uint256 xpAmount = 0;
        uint256 votesAmount = 0;
        uint256 gugoAmount = 0;
        
        // 🎁 TREASURY-SCALED Prize Break Structure (Every 10 Votes)
        // Calculate total GUGO odds based on current treasury balance
        uint256 totalGugoOdds = _getTotalGugoOdds();
        
        if (roll < 50) {
            // 50% - Base XP (+10 XP) - Every Prize Break
            rewardType = RewardType.BASE_XP;
            xpAmount = 10 + user.pendingXP;
        } else if (roll < 60) {
            // 10% - Big XP (+20 XP) - Occasional boost
            rewardType = RewardType.BIG_XP;
            xpAmount = 20 + user.pendingXP;
        } else if (roll < 70) {
            // 10% - XP + Votes (+10 XP + 10 Votes) - Loop enhancer
            rewardType = RewardType.XP_VOTES_10;
            xpAmount = 10 + user.pendingXP;
            votesAmount = 10;
        } else if (roll < (100 - totalGugoOdds)) {
            // Remaining % - Other rewards (votes only, more XP, visual flare)
            uint256 otherRoll = randomSeed % 100;
            if (otherRoll < 50) {
                // Votes Only (+30 Votes) - Pure quantity
            rewardType = RewardType.VOTE_BONUS;
                xpAmount = user.pendingXP;
            votesAmount = 30;
        } else {
                // More XP + Votes (+5 XP + 20 Votes) - Utility boost
                rewardType = RewardType.XP_VOTES_5;
                xpAmount = 5 + user.pendingXP;
                votesAmount = 20;
            }
        } else {
            // GUGO Prizes - Treasury-scaled odds and tiers
            (rewardType, gugoAmount) = _getGugoReward(randomSeed);
            xpAmount = user.pendingXP; // Only accumulated XP for GUGO rewards
        }
        
        // Apply rewards
        user.xp += xpAmount;
        user.votesRemaining += votesAmount;
        user.pendingXP = 0; // Reset pending XP
        
        // Handle GUGO rewards (if prize break treasury has funds)
        if (gugoAmount > 0 && prizeBreakTreasury >= gugoAmount) {
            prizeBreakTreasury -= gugoAmount;
            // Transfer GUGO tokens to user (requires GUGO token integration)
            if (address(gugoToken) != address(0)) {
                require(gugoToken.transfer(msg.sender, gugoAmount), "GUGO transfer failed");
            }
        }
        
        // Record reward in history
        userRewardHistory[msg.sender].push(PrizeBreakReward({
            rewardType: rewardType,
            xpAmount: xpAmount,
            votesAmount: votesAmount,
            gugoAmount: gugoAmount,
            timestamp: block.timestamp
        }));
        
        emit PrizeBreakClaimed(msg.sender, rewardType, xpAmount, votesAmount, gugoAmount, user.xp);
    }
    
    function _getHigherGugoReward(uint256 randomSeed) internal view returns (RewardType rewardType, uint256 gugoAmount) {
        // Dynamic tier unlocking based on treasury balance
        uint256 unlockedTiers = _getUnlockedGugoTiers();
        
        // Ensure we have at least tier 3 unlocked for higher rewards
        if (unlockedTiers < 3) {
            // Fallback to tier 2 if tier 3+ not available
            rewardType = RewardType.GUGO_TIER_2;
            gugoAmount = _calculateGugoReward(2);
            return (rewardType, gugoAmount);
        }
        
        // Map roll to available higher tiers (3-9)
        uint256 availableHigherTiers = unlockedTiers - 2; // Subtract tiers 1 & 2
        uint256 tierRoll = randomSeed % availableHigherTiers;
        uint256 selectedTier = 3 + tierRoll;
        
        // Convert tier number to RewardType enum and calculate amount
        if (selectedTier == 3) {
            rewardType = RewardType.GUGO_TIER_3;
        } else if (selectedTier == 4) {
            rewardType = RewardType.GUGO_TIER_4;
        } else if (selectedTier == 5) {
            rewardType = RewardType.GUGO_TIER_5;
        } else if (selectedTier == 6) {
            rewardType = RewardType.GUGO_TIER_6;
        } else if (selectedTier == 7) {
            rewardType = RewardType.GUGO_TIER_7;
        } else if (selectedTier == 8) {
            rewardType = RewardType.GUGO_TIER_8;
        } else if (selectedTier == 9) {
            rewardType = RewardType.GUGO_TIER_9;
        } else {
            // Fallback to highest available tier
            rewardType = RewardType.GUGO_TIER_5;
            selectedTier = 5;
        }
        
        gugoAmount = _calculateGugoReward(selectedTier);
    }
    
    function _getTotalGugoOdds() internal view returns (uint256) {
        // 🏦 Treasury-Scaled GUGO Odds System
        if (prizeBreakTreasury >= 500000 * 1e18) {
            return 20; // 500k+ GUGO: 20%+ total GUGO odds
        } else if (prizeBreakTreasury >= 250000 * 1e18) {
            return 18; // 250k-500k GUGO: 18% total GUGO odds
        } else if (prizeBreakTreasury >= 100000 * 1e18) {
            return 15; // 100k-250k GUGO: 15% total GUGO odds
        } else if (prizeBreakTreasury >= 50000 * 1e18) {
            return 12; // 50k-100k GUGO: 12% total GUGO odds
        } else if (prizeBreakTreasury >= 20000 * 1e18) {
            return 9;  // 20k-50k GUGO: 9% total GUGO odds
        } else if (prizeBreakTreasury >= 5000 * 1e18) {
            return 6;  // 5k-20k GUGO: 6% total GUGO odds
        } else {
            return 0;  // < 5k GUGO: 0% GUGO odds
        }
    }
    
    function _getGugoReward(uint256 randomSeed) internal view returns (RewardType, uint256) {
        // Always maintain 6% odds for 600 GUGO (feels like value return)
        uint256 gugoRoll = randomSeed % 100;
        
        if (gugoRoll < 30 && prizeBreakTreasury >= 5000 * 1e18) {
            // 6% - 600 GUGO (consistent across all treasury tiers)
            return (RewardType.GUGO_TIER_1, 600 * 1e18);
        }
        
        // Distribute remaining GUGO odds among higher tiers based on treasury
        uint256 totalGugoOdds = _getTotalGugoOdds();
        uint256 remainingOdds = totalGugoOdds - 6; // Subtract 600 GUGO odds
        
        if (remainingOdds == 0) {
            // Only 600 GUGO unlocked, fallback
            return (RewardType.GUGO_TIER_1, 600 * 1e18);
        }
        
        // Map remaining odds to higher tiers
        uint256 higherRoll = randomSeed % remainingOdds;
        
        if (higherRoll < 3 && prizeBreakTreasury >= 20000 * 1e18) {
            // 3% - 1500 GUGO
            return (RewardType.GUGO_TIER_2, 1500 * 1e18);
        } else if (higherRoll < 4 && prizeBreakTreasury >= 50000 * 1e18) {
            // 1.5% - 3000 GUGO
            return (RewardType.GUGO_TIER_3, 3000 * 1e18);
        } else if (higherRoll < 5 && prizeBreakTreasury >= 100000 * 1e18) {
            // 0.5% - 5000 GUGO
            return (RewardType.GUGO_TIER_4, 5000 * 1e18);
        } else if (higherRoll < 6 && prizeBreakTreasury >= 250000 * 1e18) {
            // Very rare - 10,000 GUGO
            return (RewardType.GUGO_TIER_5, 10000 * 1e18);
        } else if (higherRoll < 7 && prizeBreakTreasury >= 500000 * 1e18) {
            // Ultra rare - 25,000 GUGO
            return (RewardType.GUGO_TIER_6, 25000 * 1e18);
        }
        
        // Fallback to 600 GUGO
        return (RewardType.GUGO_TIER_1, 600 * 1e18);
    }
    
    function _isGugoTierUnlocked(uint256 tier) internal view returns (bool) {
        // Legacy function for compatibility
        if (tier == 1) return prizeBreakTreasury >= 5000 * 1e18;
        if (tier == 2) return prizeBreakTreasury >= 20000 * 1e18;
        if (tier == 3) return prizeBreakTreasury >= 50000 * 1e18;
        if (tier == 4) return prizeBreakTreasury >= 100000 * 1e18;
        if (tier == 5) return prizeBreakTreasury >= 250000 * 1e18;
        if (tier == 6) return prizeBreakTreasury >= 500000 * 1e18;
        return false;
    }
    
    function _getUnlockedGugoTiers() internal view returns (uint256) {
        // Legacy function - returns highest unlocked tier
        if (_isGugoTierUnlocked(6)) return 6;
        if (_isGugoTierUnlocked(5)) return 5;
        if (_isGugoTierUnlocked(4)) return 4;
        if (_isGugoTierUnlocked(3)) return 3;
        if (_isGugoTierUnlocked(2)) return 2;
        if (_isGugoTierUnlocked(1)) return 1;
        return 0; // No GUGO prizes unlocked (treasury < 5k GUGO)
    }
    
    function _getHigherGugoReward(uint256 randomSeed) internal view returns (RewardType, uint256) {
        uint256 unlockedTiers = _getUnlockedGugoTiers();
        
        // Only award higher tiers if treasury has enough
        if (unlockedTiers <= 3) {
            // Fallback to Tier 3 if no higher tiers unlocked
            return (RewardType.GUGO_TIER_3, 3000 * 1e18);
        }
        
        // Distribute among available higher tiers (4-9)
        uint256 availableHigherTiers = unlockedTiers - 3; // Subtract Tiers 1-3
        uint256 tierRoll = randomSeed % availableHigherTiers;
        uint256 selectedTier = 4 + tierRoll; // Start from Tier 4
        
        // Map to reward types and amounts
        if (selectedTier == 4) {
            return (RewardType.GUGO_TIER_4, 5000 * 1e18);   // 5K GUGO (~$17)
        } else if (selectedTier == 5) {
            return (RewardType.GUGO_TIER_5, 10000 * 1e18);  // 10K GUGO (~$34)
        } else if (selectedTier == 6) {
            return (RewardType.GUGO_TIER_6, 25000 * 1e18);  // 25K GUGO (~$85)
        } else if (selectedTier == 7) {
            return (RewardType.GUGO_TIER_7, 50000 * 1e18);  // 50K GUGO (~$170)
        } else if (selectedTier == 8) {
            return (RewardType.GUGO_TIER_8, 100000 * 1e18); // 100K GUGO (~$340)
        } else if (selectedTier == 9) {
            return (RewardType.GUGO_TIER_9, 250000 * 1e18); // 250K GUGO (~$850)
        }
        
        // Fallback to highest available tier
        return (RewardType.GUGO_TIER_3, 3000 * 1e18);
    }
    
    function _calculateGugoReward(uint256 tier) internal view returns (uint256) {
        // Treasury safety check - get available funds for prizes
        uint256 availableFunds = _getAvailablePrizeFunds();
        
        // Use original whitepaper prize amounts - fixed GUGO amounts per tier
        uint256 targetAmount;
        
        // 🎁 OFFICIAL GUGO Prize Amounts (Fixed from prize structure)
        if (tier == 1) {
            // Tier 1: 600 GUGO (~$2.00)
            targetAmount = 600 * 1e18;
        } else if (tier == 2) {
            // Tier 2: 1500 GUGO (~$5.10)
            targetAmount = 1500 * 1e18;
        } else if (tier == 3) {
            // Tier 3: 3000 GUGO (~$10.20)
            targetAmount = 3000 * 1e18;
        } else if (tier >= 4 && tier <= 6) {
            // Tier 4-6: 5000-25,000 GUGO (locked unless treasury > certain levels)
            // Scales based on treasury balance
            uint256 baseAmount = 5000 + (tier - 4) * 10000; // 5K, 15K, 25K
            targetAmount = baseAmount * 1e18;
        } else {
            return 0; // Invalid tier
        }
        
        return _applySafetyScaling(targetAmount, availableFunds, tier);
    }
    
    function _applySafetyScaling(uint256 targetAmount, uint256 availableFunds, uint256 tier) internal pure returns (uint256) {
        // Safety scaling: reduce rewards if treasury is low, but never increase beyond target
        
        // Calculate minimum sustainable amount based on tier
        uint256 minAmount;
        if (tier == 1) {
            minAmount = 2 * 1e18;  // Minimum $0.40 for Tier 1
        } else if (tier == 2) {
            minAmount = 5 * 1e18;  // Minimum $1.00 for Tier 2
        } else {
            minAmount = targetAmount / 10; // 10% of target for higher tiers
        }
        
        // If we have plenty of funds (20x the target), return full target
        if (availableFunds >= targetAmount * 20) {
            return targetAmount;
        }
        
        // If funds are critically low (less than 10x target), scale down
        if (availableFunds < targetAmount * 10) {
            // Linear scaling between minimum and target based on available funds
            uint256 scalingFactor = (availableFunds * 100) / (targetAmount * 10); // 0-100%
            uint256 scaledAmount = minAmount + ((targetAmount - minAmount) * scalingFactor) / 100;
            return scaledAmount > targetAmount ? targetAmount : scaledAmount;
        }
        
        // Normal case: return full target amount
        return targetAmount;
    }
    
    function _getAvailablePrizeFunds() internal view returns (uint256) {
        // Reserve 20% of prize break treasury for safety, 80% available for immediate prizes
        return (prizeBreakTreasury * 80) / 100;
    }
    
    function getPrizeBreakInfo(address userAddr) external view returns (
        uint256 votesEligibleForPrizeBreaks,
        uint256 prizeBreaksAvailable,
        uint256 pendingXP,
        uint256 nextPrizeBreakAt,
        uint256 unlockedGugoTiers
    ) {
        User memory user = users[userAddr];
        uint256 votesEligible = user.totalVotes - user.lastPrizeBreak;
        uint256 prizeBreaks = votesEligible / PRIZE_BREAK_THRESHOLD;
        uint256 votesNeeded = PRIZE_BREAK_THRESHOLD - (votesEligible % PRIZE_BREAK_THRESHOLD);
        uint256 gugoTiers = _getUnlockedGugoTiers();
        
        return (votesEligible, prizeBreaks, user.pendingXP, votesNeeded, gugoTiers);
    }
    
    // ============ ELO SYSTEM ============
    
    function _updateEloRatings(uint256 winnerTokenId, uint256 loserTokenId) internal {
        uint256 winnerElo = nfts[winnerTokenId].eloRating;
        uint256 loserElo = nfts[loserTokenId].eloRating;
        
        // Calculate expected scores (simplified Elo)
        uint256 expectedWinner = _getExpectedScore(winnerElo, loserElo);
        uint256 expectedLoser = 1000 - expectedWinner; // Out of 1000
        
        // Calculate new ratings
        uint256 newWinnerElo = winnerElo + (K_FACTOR * (1000 - expectedWinner)) / 1000;
        uint256 newLoserElo = loserElo - (K_FACTOR * (1000 - expectedLoser)) / 1000;
        
        // Ensure ratings don't go below 100
        if (newLoserElo < 100) newLoserElo = 100;
        
        // Update storage
        nfts[winnerTokenId].eloRating = newWinnerElo;
        nfts[loserTokenId].eloRating = newLoserElo;
        
        emit EloUpdated(winnerTokenId, winnerElo, newWinnerElo);
        emit EloUpdated(loserTokenId, loserElo, newLoserElo);
    }
    
    function _getExpectedScore(uint256 ratingA, uint256 ratingB) internal pure returns (uint256) {
        // Simplified Elo expected score calculation
        // Returns value out of 1000 (so 500 = 50% chance)
        int256 diff = int256(ratingA) - int256(ratingB);
        
        if (diff >= 400) return 900;      // 90% chance
        if (diff >= 200) return 750;     // 75% chance
        if (diff >= 100) return 650;     // 65% chance
        if (diff >= 50) return 575;      // 57.5% chance
        if (diff >= 0) return 500;       // 50% chance
        if (diff >= -50) return 425;     // 42.5% chance
        if (diff >= -100) return 350;    // 35% chance
        if (diff >= -200) return 250;    // 25% chance
        if (diff >= -400) return 100;    // 10% chance
        return 50;                       // 5% chance
    }
    
    // ============ VIEW FUNCTIONS ============
    
    function getUserStats(address user) external view returns (
        uint256 xp,
        uint256 totalVotes,
        uint256 winningVotes,
        uint256 streak,
        uint256 pendingXP,
        uint256 votesRemaining,
        bool isRegistered
    ) {
        User memory u = users[user];
        return (u.xp, u.totalVotes, u.winningVotes, u.streak, u.pendingXP, u.votesRemaining, u.isRegistered);
    }
    
    function getNFTStats(uint256 tokenId) external view returns (
        uint256 eloRating,
        uint256 totalVotes,
        uint256 wins,
        uint256 losses,
        bool isActive
    ) {
        NFT memory nft = nfts[tokenId];
        return (nft.eloRating, nft.totalVotes, nft.wins, nft.losses, nft.isActive);
    }
    
    function getVote(bytes32 voteId) external view returns (Vote memory) {
        return votes[voteId];
    }
    
    function hasUserVotedInMatchup(address user, bytes32 matchupId) external view returns (bool) {
        return hasVotedInMatchup[user][matchupId];
    }
    
    // ============ REVENUE DISTRIBUTION SYSTEM ============
    
    function distributeRevenue(uint256 totalAmount) external onlyOwner {
        require(address(gugoToken) != address(0), "GUGO token not set");
        require(gugoToken.transferFrom(msg.sender, address(this), totalAmount), "Transfer failed");
        
        // Rule of Thirds Distribution
        uint256 burnAmount = (totalAmount * 3333) / 10000;          // 33.33%
        uint256 prizeBreakAmount = (totalAmount * 2333) / 10000;    // 23.33%
        uint256 weeklyRaffleAmount = (totalAmount * 1000) / 10000;  // 10.00%
        uint256 operationsAmount = totalAmount - burnAmount - prizeBreakAmount - weeklyRaffleAmount; // 33.33%
        
        // Burn tokens
        if (burnAmount > 0) {
            require(gugoToken.transfer(BURN_WALLET, burnAmount), "Burn transfer failed");
        }
        
        // Add to prize break treasury
        prizeBreakTreasury += prizeBreakAmount;
        
        // Add to weekly raffle treasury
        weeklyRaffleTreasury += weeklyRaffleAmount;
        
        // Send to operations wallet
        if (operationsAmount > 0 && operationsWallet != address(0)) {
            require(gugoToken.transfer(operationsWallet, operationsAmount), "Operations transfer failed");
        }
        
        emit RevenueDistributed(totalAmount, burnAmount, prizeBreakAmount, weeklyRaffleAmount, operationsAmount);
        emit TreasuryUpdated(prizeBreakTreasury, _getUnlockedGugoTiers());
    }
    
    // ============ TREASURY MANAGEMENT ============
    
    function depositToPrizeBreakTreasury(uint256 amount) external onlyOwner {
        require(address(gugoToken) != address(0), "GUGO token not set");
        require(gugoToken.transferFrom(msg.sender, address(this), amount), "Transfer failed");
        
        prizeBreakTreasury += amount;
        uint256 tiersUnlocked = _getUnlockedGugoTiers();
        
        emit TreasuryDeposit("prizeBreak", amount, prizeBreakTreasury);
        emit TreasuryUpdated(prizeBreakTreasury, tiersUnlocked);
    }
    
    function depositToWeeklyRaffleTreasury(uint256 amount) external onlyOwner {
        require(address(gugoToken) != address(0), "GUGO token not set");
        require(gugoToken.transferFrom(msg.sender, address(this), amount), "Transfer failed");
        
        weeklyRaffleTreasury += amount;
        
        emit TreasuryDeposit("weeklyRaffle", amount, weeklyRaffleTreasury);
    }
    
    function transferBetweenTreasuries(uint256 amount, bool prizeBreakToRaffle) external onlyOwner {
        if (prizeBreakToRaffle) {
            require(prizeBreakTreasury >= amount, "Insufficient prize break treasury");
            prizeBreakTreasury -= amount;
            weeklyRaffleTreasury += amount;
            emit TreasuryDeposit("weeklyRaffle", amount, weeklyRaffleTreasury);
        } else {
            require(weeklyRaffleTreasury >= amount, "Insufficient weekly raffle treasury");
            weeklyRaffleTreasury -= amount;
            prizeBreakTreasury += amount;
            emit TreasuryDeposit("prizeBreak", amount, prizeBreakTreasury);
        }
        
        emit TreasuryUpdated(prizeBreakTreasury, _getUnlockedGugoTiers());
    }
    
    // Legacy function for migration
    function depositGugoToTreasury(uint256 amount) external onlyOwner {
        require(address(gugoToken) != address(0), "GUGO token not set");
        require(gugoToken.transferFrom(msg.sender, address(this), amount), "Transfer failed");
        
        legacyTreasury += amount;
        
        emit TreasuryDeposit("legacy", amount, legacyTreasury);
    }
    
    function migrateLegacyTreasury() external onlyOwner {
        require(legacyTreasury > 0, "No legacy treasury to migrate");
        
        // Distribute legacy treasury according to rule of thirds
        uint256 totalAmount = legacyTreasury;
        uint256 prizeBreakAmount = (totalAmount * 7000) / 10000;    // 70% to prize breaks
        uint256 weeklyRaffleAmount = (totalAmount * 3000) / 10000;  // 30% to weekly raffles
        
        prizeBreakTreasury += prizeBreakAmount;
        weeklyRaffleTreasury += weeklyRaffleAmount;
        legacyTreasury = 0;
        
        emit TreasuryDeposit("prizeBreak", prizeBreakAmount, prizeBreakTreasury);
        emit TreasuryDeposit("weeklyRaffle", weeklyRaffleAmount, weeklyRaffleTreasury);
        emit TreasuryUpdated(prizeBreakTreasury, _getUnlockedGugoTiers());
    }
    
    function setGugoToken(address _gugoToken) external onlyOwner {
        gugoToken = IERC20(_gugoToken);
    }
    
    function setBaseXPAmount(uint256 _baseXPAmount) external onlyOwner {
        baseXPAmount = _baseXPAmount;
    }
    
    function getUserRewardHistory(address user) external view returns (PrizeBreakReward[] memory) {
        return userRewardHistory[user];
    }
    
    function getTreasuryInfo() external view returns (
        uint256 prizeBreakBalance,
        uint256 weeklyRaffleBalance,
        uint256 legacyBalance,
        uint256 unlockedTiers,
        uint256 availablePrizeFunds,
        address gugoTokenAddress,
        address operationsWalletAddress
    ) {
        return (
            prizeBreakTreasury,
            weeklyRaffleTreasury, 
            legacyTreasury,
            _getUnlockedGugoTiers(), 
            _getAvailablePrizeFunds(), 
            address(gugoToken),
            operationsWallet
        );
    }
    
    function getWeeklyRaffleInfo() external view returns (
        uint256 treasuryBalance,
        uint256 estimatedNextPrize,
        bool canAffordPrize
    ) {
        treasuryBalance = weeklyRaffleTreasury;
        // Estimate next week's prize as 80% of treasury (reserve 20% for sustainability)
        estimatedNextPrize = (treasuryBalance * 80) / 100;
        canAffordPrize = treasuryBalance >= 100 * 1e18; // Minimum 100 GUGO for raffle
        
        return (treasuryBalance, estimatedNextPrize, canAffordPrize);
    }
    
    function getRewardPreview(uint256 tier) external view returns (
        uint256 targetAmount,
        uint256 actualAmount,
        uint256 scalingPercentage
    ) {
        require(tier >= 1 && tier <= 9, "Invalid tier");
        
        uint256 availableFunds = _getAvailablePrizeFunds();
        
        if (tier == 1) {
            targetAmount = 10 * 1e18;
        } else if (tier == 2) {
            targetAmount = 25 * 1e18;
        } else {
            uint256 baseReward = gugoTreasury / 400;
            if (tier == 3) targetAmount = baseReward / 5;
            else if (tier == 4) targetAmount = baseReward / 2;
            else if (tier == 5) targetAmount = baseReward;
            else if (tier == 6) targetAmount = baseReward * 2;
            else if (tier == 7) targetAmount = baseReward * 4;
            else if (tier == 8) targetAmount = baseReward * 8;
            else if (tier == 9) targetAmount = baseReward * 16;
        }
        
        actualAmount = _applySafetyScaling(targetAmount, availableFunds, tier);
        scalingPercentage = targetAmount > 0 ? (actualAmount * 100) / targetAmount : 0;
    }
    
    function getTreasuryHealth() external view returns (
        bool isHealthy,
        uint256 sustainabilityDays,
        string memory status
    ) {
        uint256 availableFunds = _getAvailablePrizeFunds();
        uint256 dailyBurnEstimate = _estimateDailyBurn();
        
        if (dailyBurnEstimate == 0) {
            return (true, type(uint256).max, "No prize activity");
        }
        
        sustainabilityDays = availableFunds / dailyBurnEstimate;
        
        if (sustainabilityDays > 365) {
            isHealthy = true;
            status = "Excellent";
        } else if (sustainabilityDays > 180) {
            isHealthy = true;
            status = "Good";
        } else if (sustainabilityDays > 90) {
            isHealthy = true;
            status = "Fair";
        } else if (sustainabilityDays > 30) {
            isHealthy = false;
            status = "Warning";
        } else {
            isHealthy = false;
            status = "Critical";
        }
    }
    
    function _estimateDailyBurn() internal view returns (uint256) {
        // Estimate daily GUGO burn based on prize probabilities and typical usage
        // Assume 100 prize breaks per day at current reward levels
        uint256 tier1Reward = _calculateGugoReward(1);
        uint256 tier2Reward = _calculateGugoReward(2);
        
        // Weighted average: 18% tier 1, 12% tier 2, 10% higher tiers (avg tier 4)
        uint256 tier4Reward = _calculateGugoReward(4);
        uint256 avgReward = (tier1Reward * 18 + tier2Reward * 12 + tier4Reward * 10) / 40;
        
        return avgReward * 100; // 100 estimated prize breaks per day
    }
    
    // ============ ADMIN FUNCTIONS ============
    
    function toggleNFTActive(uint256 tokenId) external onlyOwner {
        nfts[tokenId].isActive = !nfts[tokenId].isActive;
    }
    
    function getGlobalStats() external view returns (
        uint256 totalVotesCount,
        uint256 prizeBreakBalance,
        uint256 weeklyRaffleBalance,
        uint256 unlockedGugoTiers
    ) {
        return (totalVotes, prizeBreakTreasury, weeklyRaffleTreasury, _getUnlockedGugoTiers());
    }
}