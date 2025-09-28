# 🧮 POA v2 Computation Strategy

## 📊 **Computation Frequency Analysis**

### **Current Status: Manual Admin-Only**
- ✅ **Admin Panel**: POA v2 scores visible only to admins
- ✅ **Manual Computation**: Triggered by admin for testing
- ✅ **Real Data**: Using actual NFT voting data (297 NFTs ready)
- ❌ **User Display**: Hidden from public interface (as requested)

---

## 🎯 **Recommended Hybrid Approach**

### **1. Real-time Computation (High Priority NFTs)**
**When**: Immediately after each vote
**For**: NFTs with significant voting activity
**Triggers**:
- NFT receives a new vote
- Vote count reaches milestone (10, 25, 50+ votes)
- FIRE vote added
- Super vote received

**Benefits**:
- Always up-to-date for popular NFTs
- Immediate feedback for active collections
- Real-time leaderboard accuracy

### **2. Batch Processing (Bulk Updates)**
**When**: Daily at 2 AM UTC
**For**: All NFTs with votes but no recent computation
**Process**:
- Compute POA v2 for NFTs with 1+ votes
- Recalculate existing scores (data may have changed)
- Update collection statistics
- Generate daily analytics

**Benefits**:
- Handles large datasets efficiently
- Catches edge cases missed by real-time
- Provides system-wide consistency

### **3. Trigger-based Computation (Smart Updates)**
**When**: Specific events occur
**Triggers**:
- New collection activated
- User reliability scores updated
- Slider normalization parameters change
- System maintenance completed

---

## ⚡ **Implementation Phases**

### **Phase 1: Admin-Only (Current)**
- ✅ Manual computation via admin panel
- ✅ POA v2 scores hidden from users
- ✅ Testing and validation with real data
- ✅ Performance optimization

### **Phase 2: Automated Background Processing**
- 🔄 Daily batch computation (2 AM UTC)
- 🔄 Real-time computation for high-activity NFTs
- 🔄 Automatic retry logic for failed computations
- 🔄 Computation queue management

### **Phase 3: User Display (Future)**
- 🔮 Feature flag to enable user-facing POA v2
- 🔮 Gradual rollout by collection
- 🔮 A/B testing with current scoring
- 🔮 Full public launch

---

## 🔧 **Technical Implementation**

### **Real-time Computation Hook**
```typescript
// In voting pipeline (Phase A2)
export async function processVote(voteData: VoteSubmission) {
  // Process vote normally
  const result = await processExistingVote(voteData);
  
  // Trigger POA v2 computation if enabled
  if (shouldComputePOAv2RealTime(voteData)) {
    await computePOAv2ForNFT(voteData.nft_a_id);
    if (voteData.nft_b_id) {
      await computePOAv2ForNFT(voteData.nft_b_id);
    }
  }
  
  return result;
}
```

### **Daily Batch Job**
```typescript
// Scheduled function (Vercel Cron or external)
export async function dailyPOAv2Computation() {
  console.log('🧮 Starting daily POA v2 batch computation...');
  
  // Get NFTs that need computation
  const candidates = await getNFTsNeedingComputation();
  
  // Process in batches to avoid timeouts
  const summary = await computePOAv2Batch(candidates, {
    batchSize: 50,
    delayMs: 100,
    skipExisting: false, // Recalculate all
  });
  
  console.log('✅ Daily computation complete:', summary);
  return summary;
}
```

### **Smart Triggers**
```typescript
// Trigger computation based on thresholds
function shouldComputePOAv2RealTime(voteData: VoteSubmission): boolean {
  return (
    voteData.vote_type === 'super' || // Always compute for super votes
    voteData.is_fire_vote || // Always compute for FIRE votes
    isHighActivityNFT(voteData.nft_a_id) || // High-activity NFTs
    reachedVoteMilestone(voteData.nft_a_id) // Vote milestones
  );
}
```

---

## 📈 **Performance Considerations**

### **Database Load Management**
- **Batch Size**: 10-50 NFTs per batch
- **Delays**: 100-500ms between batches
- **Timeouts**: 30-60 seconds per computation
- **Retry Logic**: 3 attempts with exponential backoff

### **Computation Priorities**
1. **High Priority**: NFTs with 10+ votes, recent activity
2. **Medium Priority**: NFTs with 3-9 votes, moderate activity  
3. **Low Priority**: NFTs with 1-2 votes, older activity

### **Resource Optimization**
- **Caching**: Cache user reliability scores (1 hour)
- **Indexing**: Optimize database queries with proper indexes
- **Monitoring**: Track computation success rates and timing
- **Alerts**: Notify admins of computation failures

---

## 🎛️ **Admin Controls**

### **Current Admin Panel Features**
- ✅ **System Overview**: Total NFTs, POA v2 coverage, statistics
- ✅ **Collection Management**: Compute by collection (5-10 NFTs)
- ✅ **Manual Computation**: Single NFT or batch processing
- ✅ **Real-time Logs**: Computation activity and results
- ✅ **Performance Metrics**: Success rates, timing, errors

### **Planned Admin Features**
- 🔄 **Computation Scheduling**: Enable/disable automatic computation
- 🔄 **Threshold Management**: Adjust real-time computation triggers
- 🔄 **Quality Monitoring**: Track POA v2 score distributions
- 🔄 **Rollback Tools**: Revert problematic computations

---

## 🚀 **Rollout Strategy**

### **Week 1-2: Admin Testing (Current)**
- Manual computation via admin panel
- Validate algorithm with real data
- Optimize performance and reliability
- Build confidence in POA v2 scores

### **Week 3-4: Automated Background**
- Implement daily batch computation
- Add real-time computation for high-activity NFTs
- Monitor system performance and stability
- Refine computation thresholds

### **Week 5+: Gradual User Rollout**
- Enable POA v2 display for specific collections
- A/B test with current scoring system
- Gather user feedback and iterate
- Full public launch when ready

---

## 💡 **Key Benefits of This Strategy**

1. **Scalability**: Handles 54K+ NFTs efficiently
2. **Reliability**: Multiple computation methods ensure coverage
3. **Performance**: Real-time for active NFTs, batch for others
4. **Flexibility**: Easy to adjust thresholds and priorities
5. **Monitoring**: Full visibility into computation health
6. **Safety**: Admin-only testing before user rollout

---

**Current Status**: ✅ **Phase 1 Complete** - Admin panel ready for POA v2 computation and monitoring with real NFT data.

