/**
 * 🔍 Get Real Test Data API
 * 
 * Simple endpoint to get real NFT and user data for testing
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '../../../../lib/supabase';

export async function GET() {
  try {
    // Get one real user with full wallet address
    const { data: users, error: userError } = await supabase
      .from('users')
      .select('wallet_address')
      .not('wallet_address', 'is', null)
      .limit(1);
    
    if (userError || !users || users.length === 0) {
      throw new Error(`No users found: ${userError?.message}`);
    }
    
    // Get two NFTs with POA v2 data
    const { data: nfts, error: nftError } = await supabase
      .from('nfts')
      .select('id, name, collection_name, elo_mean, elo_sigma')
      .not('elo_mean', 'is', null)
      .limit(2);
    
    if (nftError || !nfts || nfts.length < 2) {
      throw new Error(`Insufficient NFTs found: ${nftError?.message}`);
    }
    
    return NextResponse.json({
      success: true,
      data: {
        user: {
          wallet_address: users[0].wallet_address,
        },
        nfts: nfts.map(nft => ({
          id: nft.id,
          name: nft.name,
          collection: nft.collection_name,
          elo_mean: nft.elo_mean,
          elo_sigma: nft.elo_sigma,
        })),
      }
    });
    
  } catch (error) {
    console.error('❌ Failed to get real test data:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Failed to get real test data',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

