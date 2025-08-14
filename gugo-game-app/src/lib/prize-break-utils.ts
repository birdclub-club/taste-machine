// 🎁 Prize Break Utility Functions
// Handles XP-based graduated prize break system

/**
 * Get the prize break threshold based on user XP
 * @param userXP - User's current XP amount
 * @returns Number of votes required for next prize break
 */
export const getPrizeBreakThreshold = (userXP: number): number => {
  return userXP >= 100 ? 20 : 10; // 20 votes for experienced users (100+ XP), 10 for new users
};

/**
 * Check if user is in the experienced tier (100+ XP)
 * @param userXP - User's current XP amount
 * @returns True if user is experienced (gets 20-vote prize breaks)
 */
export const isExperiencedUser = (userXP: number): boolean => {
  return userXP >= 100;
};

/**
 * Calculate if current vote count triggers a prize break
 * @param voteCount - Current vote count
 * @param userXP - User's current XP amount
 * @returns True if this vote triggers a prize break
 */
export const isPrizeBreakVote = (voteCount: number, userXP: number): boolean => {
  const threshold = getPrizeBreakThreshold(userXP);
  return voteCount > 0 && voteCount % threshold === 0;
};

/**
 * Get votes remaining until next prize break
 * @param voteCount - Current vote count
 * @param userXP - User's current XP amount
 * @returns Number of votes until next prize break
 */
export const getVotesUntilPrizeBreak = (voteCount: number, userXP: number): number => {
  const threshold = getPrizeBreakThreshold(userXP);
  const votesInCurrentCycle = voteCount % threshold;
  return threshold - votesInCurrentCycle;
};

/**
 * Get progress percentage toward next prize break
 * @param voteCount - Current vote count
 * @param userXP - User's current XP amount
 * @returns Progress percentage (0-100)
 */
export const getPrizeBreakProgress = (voteCount: number, userXP: number): number => {
  const threshold = getPrizeBreakThreshold(userXP);
  const votesInCurrentCycle = voteCount % threshold;
  return (votesInCurrentCycle / threshold) * 100;
};

/**
 * Get user tier information for display
 * @param userXP - User's current XP amount
 * @returns Object with tier info
 */
export const getUserTierInfo = (userXP: number) => {
  const isExperienced = isExperiencedUser(userXP);
  return {
    tier: isExperienced ? 'experienced' : 'new',
    threshold: getPrizeBreakThreshold(userXP),
    description: isExperienced 
      ? 'Premium rewards every 20 votes' 
      : 'Frequent rewards every 10 votes',
    xpUntilUpgrade: isExperienced ? 0 : Math.max(0, 100 - userXP)
  };
};
