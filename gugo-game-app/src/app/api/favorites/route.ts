import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@lib/supabase';

// GET - Fetch user's favorites
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const walletAddress = searchParams.get('wallet');

    if (!walletAddress) {
      return NextResponse.json({ 
        error: 'Wallet address required' 
      }, { status: 400 });
    }

    console.log(`📚 Fetching favorites for wallet: ${walletAddress}`);

    const { data, error } = await supabase
      .rpc('get_user_favorites', { p_wallet_address: walletAddress });

    if (error) {
      console.error('❌ Error fetching favorites:', error);
      return NextResponse.json({ 
        error: 'Failed to fetch favorites',
        details: error.message 
      }, { status: 500 });
    }

    console.log(`✅ Found ${data?.length || 0} favorites`);
    
    return NextResponse.json({ 
      favorites: data || [],
      count: data?.length || 0
    });

  } catch (error) {
    console.error('❌ Unexpected error in favorites GET:', error);
    return NextResponse.json({ 
      error: 'Internal server error' 
    }, { status: 500 });
  }
}

// POST - Add NFT to favorites
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      walletAddress, 
      nftId, 
      tokenId, 
      collectionName, 
      imageUrl, 
      collectionAddress,
      voteType = 'fire' 
    } = body;

    if (!walletAddress || !nftId) {
      return NextResponse.json({ 
        error: 'Wallet address and NFT ID required' 
      }, { status: 400 });
    }

    console.log(`⭐ Adding to favorites: ${nftId} for ${walletAddress}`);

    // Ensure user exists in users table before adding favorite
    const { data: existingUser } = await supabase
      .from('users')
      .select('id')
      .eq('wallet_address', walletAddress)
      .single();

    if (!existingUser) {
      console.log(`👤 Creating user record for ${walletAddress}`);
      const { error: createUserError } = await supabase
        .from('users')
        .insert({
          wallet_address: walletAddress,
          wallet_type: 'unknown', // Will be updated on first vote/interaction
          xp: 0,
          total_votes: 0
        });

      if (createUserError) {
        console.error('❌ Failed to create user:', createUserError);
        return NextResponse.json({ 
          error: 'Failed to create user record',
          details: createUserError.message 
        }, { status: 500 });
      }
    }

    const { data, error } = await supabase
      .rpc('add_to_favorites', {
        p_wallet_address: walletAddress,
        p_nft_id: nftId,
        p_token_id: tokenId,
        p_collection_name: collectionName,
        p_image_url: imageUrl,
        p_collection_address: collectionAddress,
        p_vote_type: voteType
      });

    if (error) {
      console.error('❌ Error adding to favorites:', error);
      return NextResponse.json({ 
        error: 'Failed to add to favorites',
        details: error.message 
      }, { status: 500 });
    }

    console.log(`✅ Added to favorites with ID: ${data}`);
    
    return NextResponse.json({ 
      success: true,
      favoriteId: data,
      message: 'Added to favorites'
    });

  } catch (error) {
    console.error('❌ Unexpected error in favorites POST:', error);
    return NextResponse.json({ 
      error: 'Internal server error' 
    }, { status: 500 });
  }
}

// DELETE - Remove NFT from favorites
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const walletAddress = searchParams.get('wallet');
    const nftId = searchParams.get('nftId');

    if (!walletAddress || !nftId) {
      return NextResponse.json({ 
        error: 'Wallet address and NFT ID required' 
      }, { status: 400 });
    }

    console.log(`🗑️ Removing from favorites: ${nftId} for ${walletAddress}`);

    const { data, error } = await supabase
      .rpc('remove_from_favorites', {
        p_wallet_address: walletAddress,
        p_nft_id: nftId
      });

    if (error) {
      console.error('❌ Error removing from favorites:', error);
      return NextResponse.json({ 
        error: 'Failed to remove from favorites',
        details: error.message 
      }, { status: 500 });
    }

    console.log(`✅ Removed from favorites: ${data}`);
    
    return NextResponse.json({ 
      success: data,
      message: data ? 'Removed from favorites' : 'NFT not found in favorites'
    });

  } catch (error) {
    console.error('❌ Unexpected error in favorites DELETE:', error);
    return NextResponse.json({ 
      error: 'Internal server error' 
    }, { status: 500 });
  }
}