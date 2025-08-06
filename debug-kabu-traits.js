const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  'https://xcruwistwdmytlcbqbij.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhjcnV3aXN0d2RteXRsY2JxYmlqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzI5Mzg3MDIsImV4cCI6MjA0ODUxNDcwMn0.gCmOu2fBgkuJ4P2RhF3gNR1BYYJbx5kTw6KO7c1HI3A'
)

async function checkKabuTraits() {
  console.log('🔍 Checking Kabu collection traits...')
  
  // Get some Kabu NFTs to examine their trait structure
  const { data: kabuNfts, error } = await supabase
    .from('nfts')
    .select('id, name, collection_name, traits')
    .eq('collection_name', 'Kabu')
    .limit(10)
  
  if (error) {
    console.error('❌ Error fetching Kabu NFTs:', error)
    return
  }
  
  console.log(`\n📊 Found ${kabuNfts.length} Kabu NFTs`)
  
  kabuNfts.forEach((nft, i) => {
    console.log(`\n--- Kabu NFT ${i + 1}: ${nft.name} ---`)
    console.log('Traits:', JSON.stringify(nft.traits, null, 2))
    
    // Check specifically for Status trait
    if (nft.traits && typeof nft.traits === 'object') {
      const statusKeys = Object.keys(nft.traits).filter(key => 
        key.toLowerCase().includes('status')
      )
      console.log('Status-related keys:', statusKeys)
      
      statusKeys.forEach(key => {
        console.log(`${key}: "${nft.traits[key]}"`)
      })
    }
  })
  
  // Also check for any with "Hidden" in traits
  console.log('\n🔍 Checking for NFTs with "Hidden" in traits...')
  const { data: hiddenNfts } = await supabase
    .from('nfts')
    .select('id, name, collection_name, traits')
    .or('traits.cs.{"Status": "Hidden"},traits.cs.{"status": "hidden"}')
    .limit(5)
    
  if (hiddenNfts?.length) {
    console.log(`\n👻 Found ${hiddenNfts.length} NFTs with Hidden status:`)
    hiddenNfts.forEach(nft => {
      console.log(`- ${nft.collection_name}: ${nft.name}`)
      console.log('  Traits:', JSON.stringify(nft.traits, null, 2))
    })
  }
}

checkKabuTraits().then(() => process.exit(0)).catch(console.error)