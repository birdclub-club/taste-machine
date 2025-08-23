# 🎛️ POA v2 Environment Variables

Add these to your `.env.local` file to configure the POA v2 system:

```bash
# 🎛️ POA v2 Feature Flags
# Enable/disable the new Bayesian POA scoring system

# Main POA v2 toggles
POA_V2_ENABLED=false
POA_V2_COMPUTATION=false
POA_V2_DISPLAY=false
POA_V2_LEADERBOARD=false
POA_V2_PARALLEL=true
POA_V2_DEBUG=false

# Collection Aesthetic Index (CAI) toggles
CAI_ENABLED=false
CAI_COMPUTATION=false
CAI_DISPLAY=false

# POA v2 Elo System Parameters
POA_V2_ELO_BASE_K=32
POA_V2_ELO_SUPER_K=64
POA_V2_ELO_SIGMA_FLOOR=50
POA_V2_ELO_SIGMA_DECAY=10
POA_V2_ELO_SIGMA_SHRINK=0.98
POA_V2_ELO_DEFAULT_MEAN=1200
POA_V2_ELO_DEFAULT_SIGMA=350

# POA v2 User Statistics
POA_V2_USER_SLIDER_MEAN=50
POA_V2_USER_SLIDER_STD=15
POA_V2_USER_MIN_SLIDER_STD=5
POA_V2_USER_DEFAULT_RELIABILITY=1.0
POA_V2_USER_RELIABILITY_MIN=0.5
POA_V2_USER_RELIABILITY_MAX=1.5
POA_V2_USER_RELIABILITY_ALPHA=0.10

# POA v2 Component Weights (must sum to 1.0)
POA_V2_WEIGHT_ELO=0.40
POA_V2_WEIGHT_SLIDER=0.30
POA_V2_WEIGHT_FIRE=0.30

# POA v2 Normalization Ranges
POA_V2_ELO_MIN=800
POA_V2_ELO_MAX=2000
POA_V2_SIGMA_MAX=400
POA_V2_Z_SCORE_CLAMP=2.5

# POA v2 Computation Thresholds
POA_V2_MIN_VOTES_RELIABILITY=3
POA_V2_MIN_VOTES_POA=1
POA_V2_CONFIDENCE_THRESHOLD=0.6
```

## 📋 Variable Descriptions

### Feature Flags
- `POA_V2_ENABLED`: Master switch for POA v2 system
- `POA_V2_COMPUTATION`: Enable POA v2 score computation
- `POA_V2_DISPLAY`: Show POA v2 scores in UI
- `POA_V2_LEADERBOARD`: Use POA v2 for leaderboard ranking
- `POA_V2_PARALLEL`: Compute both old and new POA for comparison
- `POA_V2_DEBUG`: Enable detailed logging

### Elo System
- `POA_V2_ELO_BASE_K`: K-factor for regular votes (32)
- `POA_V2_ELO_SUPER_K`: K-factor for super votes (64)
- `POA_V2_ELO_SIGMA_FLOOR`: Minimum uncertainty (50)
- `POA_V2_ELO_SIGMA_DECAY`: Uncertainty growth between matches (10)
- `POA_V2_ELO_SIGMA_SHRINK`: Uncertainty reduction per match (0.98)

### User Statistics
- `POA_V2_USER_SLIDER_MEAN`: Default user slider average (50)
- `POA_V2_USER_SLIDER_STD`: Default user slider standard deviation (15)
- `POA_V2_USER_MIN_SLIDER_STD`: Minimum allowed std dev (5)
- `POA_V2_USER_DEFAULT_RELIABILITY`: Starting reliability score (1.0)
- `POA_V2_USER_RELIABILITY_MIN/MAX`: Reliability bounds (0.5-1.5)
- `POA_V2_USER_RELIABILITY_ALPHA`: Learning rate for reliability (0.10)

### Component Weights
- `POA_V2_WEIGHT_ELO`: Weight for Elo component (0.40)
- `POA_V2_WEIGHT_SLIDER`: Weight for slider component (0.30)
- `POA_V2_WEIGHT_FIRE`: Weight for FIRE component (0.30)

**Note**: Weights must sum to 1.0

### Ranges & Thresholds
- `POA_V2_ELO_MIN/MAX`: Elo normalization range (800-2000)
- `POA_V2_SIGMA_MAX`: Maximum uncertainty for confidence calc (400)
- `POA_V2_Z_SCORE_CLAMP`: Z-score clipping for slider normalization (2.5)
- `POA_V2_MIN_VOTES_RELIABILITY`: Minimum votes to compute reliability (3)
- `POA_V2_MIN_VOTES_POA`: Minimum votes for POA v2 score (1)
- `POA_V2_CONFIDENCE_THRESHOLD`: Minimum confidence for display (0.6)

## 🚀 Rollout Strategy

1. **Phase 0**: Set `POA_V2_ENABLED=false` (default)
2. **Phase 1**: Set `POA_V2_ENABLED=true`, `POA_V2_COMPUTATION=true`, `POA_V2_PARALLEL=true`
3. **Phase 2**: Set `POA_V2_DISPLAY=true` for A/B testing
4. **Phase 3**: Set `POA_V2_LEADERBOARD=true` for full rollout
5. **Phase 4**: Disable parallel computation once confident

