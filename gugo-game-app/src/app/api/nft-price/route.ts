import { NextRequest, NextResponse } from 'next/server';

// GET - Fetch NFT listing price (Demo version for Abstract chain)
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const collection = searchParams.get('collection');
  const token = searchParams.get('token');

  if (!collection || !token) {
    return NextResponse.json({ 
      error: 'Collection and token parameters required' 
    }, { status: 400 });
  }

  try {

    console.log(`💰 Fetching price for ${collection}:${token}`);

    // For Abstract chain, use demo pricing since marketplace APIs are limited
    // This provides immediate feedback while preserving the UI functionality
    
    console.log(`💰 Using demo pricing for Abstract chain NFT`);
    
    // Simulate realistic API delay
    await new Promise(resolve => setTimeout(resolve, 200 + Math.random() * 800));
    
    // 30% chance of having a listing for demo purposes
    const hasListing = Math.random() < 0.3;
    
    if (hasListing) {
      const price = Math.round((Math.random() * 4.99 + 0.01) * 1000) / 1000;
      console.log(`💰 Demo listing: ${price} ETH`);
      return NextResponse.json({
        price: price,
        currency: 'ETH',
        status: 'listed',
        marketUrl: `https://opensea.io/assets/abstract/${collection}/${token}`,
        note: 'Demo price (Abstract chain pricing in development)'
      });
    } else {
      console.log(`💰 Demo: unlisted`);
      return NextResponse.json({
        price: null,
        currency: 'ETH',
        status: 'unlisted',
        marketUrl: `https://opensea.io/assets/abstract/${collection}/${token}`,
        note: 'Demo unlisted (Abstract chain pricing in development)'
      });
    }

  } catch (error) {
    console.error('💰 Error in price API:', error);
    
    return NextResponse.json({
      price: null,
      currency: 'ETH',
      status: 'error',
      marketUrl: `https://opensea.io/assets/abstract/${collection}/${token}`,
      error: error instanceof Error ? error.message : 'Unknown error',
      note: 'Price API error'
    }, { status: 200 }); // Return 200 so UI can handle gracefully
  }
}