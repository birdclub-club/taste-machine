# 🔍 Backfill Analysis Summary

## 🚨 **Critical Backfill Required**

### **Current Status**
- **200+ NFTs** with significant voting activity (5+ votes) need migration to the new efficient pipeline
- **Only 12 NFTs** currently have `nft_stats` (from recent testing)
- **0 NFTs** from the historical data are in the new system
- **16 recent slider events** show the new pipeline is working for new activity

### **Vote Structure Analysis** ✅

After investigating the database structure, we've identified the correct vote categorization:

#### **Head-to-Head Votes**
- `vote_type_v2`: `"cross_coll"` or `"same_coll"`
- `vote_type`: `"regular"` (all votes)
- Has both `nft_a_id` and `nft_b_id`
- `winner_id` indicates the chosen NFT
- Super votes detected via `engagement_data.super_vote: true`

#### **Slider Votes**  
- `vote_type_v2`: `"slider"`
- `vote_type`: `"regular"` (all votes)
- Has `nft_a_id` only (`nft_b_id` is null)
- `slider_value` contains the rating (0-10 scale)

### **Migration Requirements**

#### **What Needs to Be Done**
1. **Extract historical votes** from `votes` table for NFTs with 5+ total votes
2. **Transform into event format** for the new pipeline:
   - H2H votes → `votes_events` table
   - Slider votes → `sliders_events` table
3. **Mark NFTs dirty** in `dirty_nfts` for batch processing
4. **Run batch processor** to compute `nft_stats` and potentially publish scores

#### **Migration Script Status**
- ✅ **Vote structure identified** correctly
- ✅ **Migration logic** implemented in `/api/migrate-historical-data`
- ⚠️ **Error handling** needs debugging (getting silent errors)
- 🔄 **Testing in progress** with single NFT samples

### **Example Data Analysis**

**Sample NFT**: BEEISH #4428 (ID: fae674db-eaff-4552-8aba-64f103b5e2ac)
- **Total votes**: 13 in `nfts` table
- **Historical votes found**: 10 H2H votes, 0 slider votes
- **Vote types**: All `"regular"` with `vote_type_v2` of `"cross_coll"` and `"same_coll"`
- **Existing stats**: No (needs migration)

### **Next Steps**

#### **Immediate Actions Needed**
1. **Debug migration errors** - identify why inserts are failing
2. **Test with single NFT** - ensure event insertion works
3. **Batch migrate** historical data for 200+ NFTs
4. **Run batch processor** to compute stats and scores
5. **Validate publish gates** - ensure NFTs meet requirements

#### **Expected Outcomes**
- **~200 NFTs** will have `nft_stats` computed from historical data
- **Subset of NFTs** will have published scores (those meeting publish gates)
- **Clean separation** between scored and unscored NFTs in APIs
- **Comprehensive coverage** of existing voting activity

### **Technical Details**

#### **Migration API**
```bash
# Test migration (dry run)
curl -X POST "/api/migrate-historical-data" \
  -d '{"batch_size": 10, "dry_run": true}'

# Run actual migration
curl -X POST "/api/migrate-historical-data" \
  -d '{"batch_size": 50, "dry_run": false}'
```

#### **Event Table Structure**
```sql
-- votes_events: H2H matchups
voter_id, nft_a_id, nft_b_id, winner_id, vote_type, created_at

-- sliders_events: Aesthetic ratings  
voter_id, nft_id, slider_value, created_at

-- dirty_nfts: Processing queue
nft_id, priority, reason, created_at
```

### **Risk Assessment**

#### **Low Risk**
- **New pipeline tested** and working for recent activity
- **Publish gates validated** and functioning correctly
- **Data integrity** - historical votes are preserved in original table

#### **Medium Risk**  
- **Migration complexity** - need to handle 200+ NFTs worth of historical data
- **Database performance** - large batch operations may timeout
- **Data validation** - ensure all vote types are captured correctly

### **Success Criteria**

✅ **Migration Complete** when:
- All NFTs with 5+ votes have `nft_stats` entries
- Batch processor successfully computes POA scores
- Publish gates correctly separate scored vs unscored NFTs
- APIs return proper historical + new data

**This backfill is essential for the new efficient pipeline to have complete historical context!** 🎯

