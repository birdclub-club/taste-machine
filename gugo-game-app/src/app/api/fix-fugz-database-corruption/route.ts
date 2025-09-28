import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '../../../../lib/supabase';

export async function POST(request: NextRequest) {
  try {
    const { dry_run = true } = await request.json();
    
    console.log(`🔧 ${dry_run ? 'DRY RUN' : 'EXECUTING'}: Fixing Fugz database corruption...`);

    // Find NFTs with Fugz IPFS hashes but Final Bosu collection names
    const fugzIpfsHash = 'bafybeigtz2vy5mewwum5ut4fcn5trzmufsz5jlsnfyxrsmvoxocurvqh4y';
    
    const { data: corruptedNFTs, error } = await supabase
      .from('nfts')
      .select('id, name, collection_name, image, token_id, total_votes')
      .eq('collection_name', 'Final Bosu')
      .ilike('image', `%${fugzIpfsHash}%`);

    if (error) {
      return NextResponse.json({ success: false, error: error.message });
    }

    console.log(`🔍 Found ${corruptedNFTs?.length || 0} corrupted NFTs`);

    if (!corruptedNFTs || corruptedNFTs.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No corrupted NFTs found',
        corrupted_nfts: 0
      });
    }

    let fixResults = [];

    if (dry_run) {
      // Just show what would be fixed
      fixResults = corruptedNFTs.map(nft => ({
        id: nft.id,
        name: nft.name,
        current_collection: nft.collection_name,
        should_be_collection: 'Fugz',
        action: 'WOULD_UPDATE',
        image_hash: nft.image.includes(fugzIpfsHash) ? 'FUGZ_HASH_CONFIRMED' : 'DIFFERENT_HASH'
      }));

      return NextResponse.json({
        success: true,
        dry_run: true,
        message: `Found ${corruptedNFTs.length} NFTs that need correction`,
        corrupted_nfts: corruptedNFTs.length,
        fix_preview: fixResults,
        next_step: 'Run with {"dry_run": false} to apply fixes'
      });
    }

    // Actually fix the corruption
    console.log('🔧 Applying fixes...');
    
    for (const nft of corruptedNFTs) {
      const { error: updateError } = await supabase
        .from('nfts')
        .update({ 
          collection_name: 'Fugz',
          updated_at: new Date().toISOString()
        })
        .eq('id', nft.id);

      if (updateError) {
        console.error(`❌ Failed to update NFT ${nft.id}:`, updateError);
        fixResults.push({
          id: nft.id,
          name: nft.name,
          status: 'FAILED',
          error: updateError.message
        });
      } else {
        console.log(`✅ Fixed NFT ${nft.id}: ${nft.name} → Fugz collection`);
        fixResults.push({
          id: nft.id,
          name: nft.name,
          status: 'FIXED',
          old_collection: 'Final Bosu',
          new_collection: 'Fugz'
        });
      }
    }

    const successCount = fixResults.filter(r => r.status === 'FIXED').length;
    const failureCount = fixResults.filter(r => r.status === 'FAILED').length;

    // Clear any cached collection data
    console.log('🧹 Clearing collection cache...');

    return NextResponse.json({
      success: true,
      message: `Database corruption fix complete: ${successCount} fixed, ${failureCount} failed`,
      results: {
        total_processed: corruptedNFTs.length,
        successfully_fixed: successCount,
        failed: failureCount,
        fix_details: fixResults
      },
      next_steps: [
        'Clear preloader cache',
        'Restart voting sessions',
        'Verify Fugz collection is properly disabled'
      ]
    });

  } catch (error) {
    console.error('❌ Fix error:', error);
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  return NextResponse.json({
    success: true,
    message: 'Fugz Database Corruption Fix Tool',
    usage: {
      dry_run: 'POST with {"dry_run": true} to preview fixes',
      execute: 'POST with {"dry_run": false} to apply fixes',
      description: 'Fixes NFTs with Fugz IPFS hashes incorrectly labeled as Final Bosu'
    }
  });
}

