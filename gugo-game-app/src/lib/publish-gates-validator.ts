/**
 * Publish Gates Validator
 * 
 * Determines if an NFT meets the requirements to earn a published POA score
 */

import { supabase } from '../../lib/supabase';
import { getPublishGatesConfig, hasConfidenceTierChanged, isWithinGracePeriod, type PublishGatesConfig } from './publish-gates-config';

export interface NFTDataRequirements {
  // Head-to-head data
  h2h_count: number;
  unique_opponents: number;
  
  // Slider data
  slider_count: number;
  unique_slider_users: number;
  
  // Current status
  has_published_score: boolean;
  last_published_at: string | null;
  current_poa: number | null;
  current_confidence: number | null;
}

export interface PublishGateResult {
  should_publish: boolean;
  meets_minimum_requirements: boolean;
  reason: string;
  progress: {
    h2h: number;
    unique_opponents: number;
    sliders: number;
    unique_slider_users: number;
    needed: {
      h2h: number;
      unique_opponents: number;
      sliders: number;
      unique_slider_users: number;
    };
  };
}

/**
 * Check if an NFT meets the publish gates requirements
 */
export async function checkPublishGates(
  nft_id: string,
  new_poa: number,
  new_confidence: number,
  config: PublishGatesConfig = getPublishGatesConfig()
): Promise<PublishGateResult> {
  try {
    // Get NFT data requirements
    const requirements = await getNFTDataRequirements(nft_id);
    
    // Calculate what's needed
    const needed = {
      h2h: Math.max(0, config.min_h2h_matchups - requirements.h2h_count),
      unique_opponents: Math.max(0, config.min_unique_opponents - requirements.unique_opponents),
      sliders: Math.max(0, config.min_slider_ratings - requirements.slider_count),
      unique_slider_users: Math.max(0, config.min_unique_slider_users - requirements.unique_slider_users),
    };
    
    const progress = {
      h2h: requirements.h2h_count,
      unique_opponents: requirements.unique_opponents,
      sliders: requirements.slider_count,
      unique_slider_users: requirements.unique_slider_users,
      needed,
    };
    
    // Check minimum requirements
    const meets_minimum_requirements = (
      requirements.h2h_count >= config.min_h2h_matchups &&
      requirements.unique_opponents >= config.min_unique_opponents &&
      requirements.slider_count >= config.min_slider_ratings &&
      requirements.unique_slider_users >= config.min_unique_slider_users
    );
    
    if (!meets_minimum_requirements) {
      return {
        should_publish: false,
        meets_minimum_requirements: false,
        reason: 'Insufficient data - needs more matchups and/or slider ratings',
        progress,
      };
    }
    
    // If no published score exists, publish it
    if (!requirements.has_published_score) {
      return {
        should_publish: true,
        meets_minimum_requirements: true,
        reason: 'First time publishing - minimum requirements met',
        progress,
      };
    }
    
    // Check grace period
    if (isWithinGracePeriod(requirements.last_published_at, config)) {
      return {
        should_publish: false,
        meets_minimum_requirements: true,
        reason: 'Within grace period - too soon to republish',
        progress,
      };
    }
    
    // Check if POA change is significant
    const poa_change = requirements.current_poa !== null 
      ? Math.abs(new_poa - requirements.current_poa)
      : Infinity;
    
    if (poa_change >= config.min_poa_change) {
      return {
        should_publish: true,
        meets_minimum_requirements: true,
        reason: `Significant POA change: ${poa_change.toFixed(2)} points`,
        progress,
      };
    }
    
    // Check if confidence tier changed
    if (hasConfidenceTierChanged(requirements.current_confidence, new_confidence, config)) {
      return {
        should_publish: true,
        meets_minimum_requirements: true,
        reason: 'Confidence tier changed',
        progress,
      };
    }
    
    // No significant change
    return {
      should_publish: false,
      meets_minimum_requirements: true,
      reason: 'No significant change in POA or confidence',
      progress,
    };
    
  } catch (error) {
    console.error(`Error checking publish gates for NFT ${nft_id}:`, error);
    return {
      should_publish: false,
      meets_minimum_requirements: false,
      reason: 'Error checking requirements',
      progress: {
        h2h: 0,
        unique_opponents: 0,
        sliders: 0,
        unique_slider_users: 0,
        needed: {
          h2h: config.min_h2h_matchups,
          unique_opponents: config.min_unique_opponents,
          sliders: config.min_slider_ratings,
          unique_slider_users: config.min_unique_slider_users,
        },
      },
    };
  }
}

/**
 * Get NFT data requirements from the database
 */
async function getNFTDataRequirements(nft_id: string): Promise<NFTDataRequirements> {
  // Get head-to-head data
  const h2hData = await getH2HData(nft_id);
  
  // Get slider data
  const sliderData = await getSliderData(nft_id);
  
  // Get current published score
  const publishedData = await getPublishedData(nft_id);
  
  return {
    h2h_count: h2hData.count,
    unique_opponents: h2hData.unique_opponents,
    slider_count: sliderData.count,
    unique_slider_users: sliderData.unique_users,
    has_published_score: publishedData.exists,
    last_published_at: publishedData.updated_at,
    current_poa: publishedData.poa_v2,
    current_confidence: publishedData.confidence,
  };
}

/**
 * Get head-to-head matchup data for an NFT
 */
async function getH2HData(nft_id: string): Promise<{ count: number; unique_opponents: number }> {
  try {
    // Count total H2H votes (both as nft_a and nft_b)
    const { data: votesA } = await supabase
      .from('votes_events')
      .select('nft_b_id')
      .eq('nft_a_id', nft_id);
    
    const { data: votesB } = await supabase
      .from('votes_events')
      .select('nft_a_id')
      .eq('nft_b_id', nft_id);
    
    // Combine and count unique opponents
    const opponentsA = votesA?.map(v => v.nft_b_id) || [];
    const opponentsB = votesB?.map(v => v.nft_a_id) || [];
    const allOpponents = [...opponentsA, ...opponentsB];
    const uniqueOpponents = new Set(allOpponents);
    
    return {
      count: allOpponents.length,
      unique_opponents: uniqueOpponents.size,
    };
    
  } catch (error) {
    console.error(`Error getting H2H data for NFT ${nft_id}:`, error);
    return { count: 0, unique_opponents: 0 };
  }
}

/**
 * Get slider rating data for an NFT
 */
async function getSliderData(nft_id: string): Promise<{ count: number; unique_users: number }> {
  try {
    const { data: sliders } = await supabase
      .from('sliders_events')
      .select('voter_id')
      .eq('nft_id', nft_id);
    
    if (!sliders) {
      return { count: 0, unique_users: 0 };
    }
    
    const uniqueUsers = new Set(sliders.map(s => s.voter_id));
    
    return {
      count: sliders.length,
      unique_users: uniqueUsers.size,
    };
    
  } catch (error) {
    console.error(`Error getting slider data for NFT ${nft_id}:`, error);
    return { count: 0, unique_users: 0 };
  }
}

/**
 * Get current published score data for an NFT
 */
async function getPublishedData(nft_id: string): Promise<{
  exists: boolean;
  poa_v2: number | null;
  confidence: number | null;
  updated_at: string | null;
}> {
  try {
    const { data: score } = await supabase
      .from('nft_scores')
      .select('poa_v2, confidence, updated_at')
      .eq('nft_id', nft_id)
      .single();
    
    if (!score) {
      return { exists: false, poa_v2: null, confidence: null, updated_at: null };
    }
    
    return {
      exists: true,
      poa_v2: score.poa_v2,
      confidence: score.confidence,
      updated_at: score.updated_at,
    };
    
  } catch (error) {
    // Not found is expected for unscored NFTs
    return { exists: false, poa_v2: null, confidence: null, updated_at: null };
  }
}

/**
 * Get progress summary for unscored NFT (for API responses)
 */
export async function getUnscoredNFTProgress(nft_id: string): Promise<{
  status: 'awaiting_data';
  progress: PublishGateResult['progress'];
}> {
  const config = getPublishGatesConfig();
  const requirements = await getNFTDataRequirements(nft_id);
  
  const needed = {
    h2h: Math.max(0, config.min_h2h_matchups - requirements.h2h_count),
    unique_opponents: Math.max(0, config.min_unique_opponents - requirements.unique_opponents),
    sliders: Math.max(0, config.min_slider_ratings - requirements.slider_count),
    unique_slider_users: Math.max(0, config.min_unique_slider_users - requirements.unique_slider_users),
  };
  
  return {
    status: 'awaiting_data',
    progress: {
      h2h: requirements.h2h_count,
      unique_opponents: requirements.unique_opponents,
      sliders: requirements.slider_count,
      unique_slider_users: requirements.unique_slider_users,
      needed,
    },
  };
}

