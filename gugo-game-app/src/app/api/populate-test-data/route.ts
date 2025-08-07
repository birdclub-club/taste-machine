/**
 * API endpoint to populate test NFT data
 * Since the import script has env issues, this uses the working Next.js Supabase client
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@lib/supabase';

export async function POST(request: NextRequest) {
  try {
    console.log('🎨 Populating test NFT data...');

    // Sample NFT data to get the app working
    const sampleNFTs = [
      {
        token_id: '1',
        name: 'Cool Bear #1',
        description: 'A cool bear NFT for testing',
        image: 'https://i.seadn.io/gae/Ju9CkWtV-1Okvf45wo8UctR-M9He2PjILP0oOvxE89AyiPPGtrR3gysu1Zu5BqVYdgx7jvj8f7h6P5kEqL_2zVhKQ3Q?auto=format&w=384',
        collection_name: 'Bearish',
        contract_address: '0xa6c46c07f7f1966d772e29049175ebba26262513',
        traits: {},
        current_elo: 1000,
        total_votes: 0,
        wins: 0,
        losses: 0,
        slider_average: 50,
        slider_count: 0
      },
      {
        token_id: '2',
        name: 'Cool Bear #2', 
        description: 'Another cool bear NFT for testing',
        image: 'https://i.seadn.io/gae/P8zlH4jKjvLK51cYn7k1uMCyEfKhB8KTgk9bqZI5Uv6uLhU5Zo6Aq1OOVbQf-J8zDnuKhNfF7I3DfhZ8FqE9zDxDQ?auto=format&w=384',
        collection_name: 'Bearish',
        contract_address: '0xa6c46c07f7f1966d772e29049175ebba26262513',
        traits: {},
        current_elo: 1000,
        total_votes: 0,
        wins: 0,
        losses: 0,
        slider_average: 50,
        slider_count: 0
      },
      {
        token_id: '3',
        name: 'Cool Bear #3',
        description: 'Yet another cool bear NFT for testing', 
        image: 'https://i.seadn.io/gae/H4jKB7hLJVhN9mA8mhQ9H1ZL2FNCE2XdF6bQ5DxQFxdm5WzjgWxW8aP5Q2tLkU1F1dE8VhZQ6nK1rW5pHfQ7?auto=format&w=384',
        collection_name: 'Bearish',
        contract_address: '0xa6c46c07f7f1966d772e29049175ebba26262513',
        traits: {},
        current_elo: 1000,
        total_votes: 0,
        wins: 0,
        losses: 0,
        slider_average: 50,
        slider_count: 0
      },
      {
        token_id: '4',
        name: 'Cool Bear #4',
        description: 'Fourth cool bear NFT for testing',
        image: 'https://i.seadn.io/gae/Y7kM2cX8QX5rHfY1vW2zKgU6tM9H8J4bP8uLx3NmJ6K8zKrR1mLpWx6Q1tN5hFvV8KhQ2yZ7mU2lP9kHbFjE?auto=format&w=384',
        collection_name: 'Bearish',
        contract_address: '0xa6c46c07f7f1966d772e29049175ebba26262513',
        traits: {},
        current_elo: 1000,
        total_votes: 0,
        wins: 0,
        losses: 0,
        slider_average: 50,
        slider_count: 0
      },
      {
        token_id: '5',
        name: 'Cool Bear #5',
        description: 'Fifth cool bear NFT for testing',
        image: 'https://i.seadn.io/gae/R9oM1bU7VU4eFdR2uP1zJgQ5rL8G7H3aN7qKw2MhI5I7wIdN0mKpTt5P1qL4eErT7GfK1xW6lR2nK8dIaNfC?auto=format&w=384',
        collection_name: 'Bearish',
        contract_address: '0xa6c46c07f7f1966d772e29049175ebba26262513',
        traits: {},
        current_elo: 1000,
        total_votes: 0,
        wins: 0,
        losses: 0,
        slider_average: 50,
        slider_count: 0
      },
      {
        token_id: '6',
        name: 'Cool Bear #6', 
        description: 'Sixth cool bear NFT for testing',
        image: 'https://i.seadn.io/gae/S0pN2cY8RY6sIgY2wX3zLhV7uN0I9K5cQ9vMy4OnL7L9yLsO1nMqUv7R2uO5jGwW9LiR3zY8nV3mQ0lIcOkG?auto=format&w=384',
        collection_name: 'Bearish',
        contract_address: '0xa6c46c07f7f1966d772e29049175ebba26262513',
        traits: {},
        current_elo: 1000,
        total_votes: 0,
        wins: 0,
        losses: 0,
        slider_average: 50,
        slider_count: 0
      }
    ];

    console.log(`📝 Inserting ${sampleNFTs.length} sample NFTs...`);

    const { data, error } = await supabase
      .from('nfts')
      .insert(sampleNFTs)
      .select();

    if (error) {
      console.error('❌ Insert failed:', error);
      return NextResponse.json(
        { error: 'Failed to insert NFTs', details: error },
        { status: 500 }
      );
    }

    console.log(`✅ Successfully inserted ${data.length} NFTs!`);

    return NextResponse.json({
      success: true,
      message: `Successfully inserted ${data.length} sample NFTs`,
      nfts: data
    });

  } catch (error) {
    console.error('❌ Error populating test data:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}