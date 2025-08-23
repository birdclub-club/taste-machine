import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '../../../../lib/supabase';

export async function POST(request: NextRequest) {
  try {
    const { dry_run = true } = await request.json();
    
    console.log(`🔧 ${dry_run ? 'DRY RUN' : 'EXECUTING'}: Restoring Final Bosu collection...`);

    // Step 1: Find the 3 NFTs that were moved from Final Bosu to Fugz
    // These should be token IDs 0, 611, and 8861 based on our earlier logs
    const { data: movedNFTs, error: findError } = await supabase
      .from('nfts')
      .select('id, name, collection_name, image, token_id, contract_address')
      .eq('collection_name', 'Fugz')
      .in('token_id', ['0', '611', '8861'])
      .eq('contract_address', '0x5fedb9a131f798e986109dd89942c17c25c81de3'); // Final Bosu contract

    if (findError) {
      return NextResponse.json({ success: false, error: findError.message });
    }

    console.log(`🔍 Found ${movedNFTs?.length || 0} NFTs that were moved from Final Bosu to Fugz`);

    if (!movedNFTs || movedNFTs.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No NFTs found that need to be restored to Final Bosu',
        restored_count: 0
      });
    }

    // Step 2: Check what the correct Final Bosu IPFS hash should be
    // Let's see if there are any other Final Bosu NFTs with different IPFS hashes
    const { data: existingFinalBosu, error: existingError } = await supabase
      .from('nfts')
      .select('id, name, image, token_id')
      .eq('collection_name', 'Final Bosu')
      .limit(5);

    console.log(`🔍 Existing Final Bosu NFTs: ${existingFinalBosu?.length || 0}`);
    
    if (dry_run) {
      return NextResponse.json({
        success: true,
        dry_run: true,
        message: `Found ${movedNFTs.length} NFTs to restore to Final Bosu`,
        nfts_to_restore: movedNFTs.map(nft => ({
          id: nft.id,
          name: nft.name,
          token_id: nft.token_id,
          current_collection: nft.collection_name,
          should_be_collection: 'Final Bosu',
          current_image: nft.image,
          action: 'RESTORE_TO_FINAL_BOSU'
        })),
        existing_final_bosu: existingFinalBosu,
        next_step: 'Run with {"dry_run": false} to restore these NFTs'
      });
    }

    // Step 3: Restore the NFTs to Final Bosu collection
    console.log('🔧 Restoring NFTs to Final Bosu collection...');
    
    const restoreResults = [];
    
    for (const nft of movedNFTs) {
      try {
        const { error: updateError } = await supabase
          .from('nfts')
          .update({ collection_name: 'Final Bosu' })
          .eq('id', nft.id);

        if (updateError) {
          console.error(`❌ Failed to restore ${nft.name}:`, updateError);
          restoreResults.push({
            id: nft.id,
            name: nft.name,
            status: 'FAILED',
            error: updateError.message
          });
        } else {
          console.log(`✅ Restored ${nft.name} to Final Bosu collection`);
          restoreResults.push({
            id: nft.id,
            name: nft.name,
            status: 'RESTORED',
            old_collection: 'Fugz',
            new_collection: 'Final Bosu'
          });
        }
      } catch (error) {
        console.error(`❌ Error restoring ${nft.name}:`, error);
        restoreResults.push({
          id: nft.id,
          name: nft.name,
          status: 'ERROR',
          error: (error as Error).message
        });
      }
    }

    const successCount = restoreResults.filter(r => r.status === 'RESTORED').length;
    const failCount = restoreResults.filter(r => r.status !== 'RESTORED').length;

    return NextResponse.json({
      success: true,
      message: `Final Bosu restoration complete: ${successCount} restored, ${failCount} failed`,
      results: {
        total_processed: movedNFTs.length,
        successfully_restored: successCount,
        failed: failCount,
        restore_details: restoreResults
      },
      next_steps: [
        'Clear preloader cache',
        'Verify Final Bosu collection is active',
        'Test that Final Bosu NFTs appear in matchups'
      ]
    });

  } catch (error) {
    console.error('❌ Restore Final Bosu error:', error);
    return NextResponse.json({ 
      success: false, 
      error: (error as Error).message 
    }, { status: 500 });
  }
}
