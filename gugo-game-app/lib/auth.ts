// Authentication utilities for wallet-based auth
import { supabase } from './supabase';

export interface User {
  id: string;
  wallet_address: string;
  created_at: string;
  updated_at: string;
  xp: number;
  total_votes: number;
  available_votes: number;
  last_free_vote_claim: string | null;
  username: string | null;
  avatar_url: string | null;
  wallet_type: 'agw' | 'metamask';
}

// Set wallet context for RLS (Row Level Security)
export const setWalletContext = async (walletAddress: string): Promise<boolean> => {
  try {
    console.log('Setting wallet context for:', walletAddress);
    
    // Use the RPC function to set the context
    const { data, error } = await supabase.rpc('set_config', {
      setting_name: 'app.current_wallet_address',
      setting_value: walletAddress,
      is_local: true
    });

    if (error) {
      console.error('Error setting wallet context:', error);
      return false;
    }

    console.log('Wallet context set successfully:', data);
    return true;
  } catch (error) {
    console.error('Error setting wallet context:', error);
    return false;
  }
};

// Alternative method without RLS for debugging
export const getOrCreateUserDirect = async (
  walletAddress: string, 
  walletType: 'agw' | 'metamask' = 'agw'
): Promise<User | null> => {
  try {
    console.log('Direct method: Getting or creating user for wallet:', walletAddress);
    
    // Create a service role client that bypasses RLS
    const { createClient } = await import('@supabase/supabase-js');
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    
    // Use the regular client but with a direct query
    const { data: existingUsers, error: fetchError } = await supabase
      .from('users')
      .select('*')
      .eq('wallet_address', walletAddress);

    if (fetchError) {
      console.error('Error fetching users:', fetchError);
      throw fetchError;
    }

    if (existingUsers && existingUsers.length > 0) {
      console.log('Found existing user (direct):', existingUsers[0]);
      return existingUsers[0] as User;
    }

    // User doesn't exist, create new one
    console.log('Creating new user (direct)...');
    const newUserData = {
      wallet_address: walletAddress,
      wallet_type: walletType,
      xp: 0,
      total_votes: 0,
      available_votes: 100, // Start with 100 votes for demo
      last_free_vote_claim: null,
      username: null,
      avatar_url: null
    };

    const { data: newUsers, error: createError } = await supabase
      .from('users')
      .insert([newUserData])
      .select();

    if (createError) {
      console.error('Error creating user (direct):', createError);
      throw createError;
    }

    if (newUsers && newUsers.length > 0) {
      console.log('Created new user (direct):', newUsers[0]);
      return newUsers[0] as User;
    }

    throw new Error('Failed to create user - no data returned');

  } catch (error) {
    console.error('Error in direct user creation:', error);
    return null;
  }
};

// Get or create user in the database
export const getOrCreateUser = async (
  walletAddress: string, 
  walletType: 'agw' | 'metamask' = 'agw'
): Promise<User | null> => {
  try {
    console.log('Getting or creating user for wallet:', walletAddress);
    
    // First, set the wallet context for RLS
    const contextSet = await setWalletContext(walletAddress);
    if (!contextSet) {
      console.error('Failed to set wallet context, trying direct method...');
      return await getOrCreateUserDirect(walletAddress, walletType);
    }

    // Try to get existing user first
    console.log('Attempting to fetch existing user...');
    const { data: existingUser, error: fetchError } = await supabase
      .from('users')
      .select('*')
      .eq('wallet_address', walletAddress)
      .single();

    if (fetchError && fetchError.code !== 'PGRST116') {
      // PGRST116 = "The result contains 0 rows" (user doesn't exist)
      console.error('Error fetching user:', fetchError);
      console.log('Trying direct method as fallback...');
      return await getOrCreateUserDirect(walletAddress, walletType);
    }

    if (existingUser) {
      console.log('Found existing user:', existingUser);
      return existingUser as User;
    }

    // User doesn't exist, create new one
    console.log('Creating new user...');
    const newUserData = {
      wallet_address: walletAddress,
      wallet_type: walletType,
      xp: 0,
      total_votes: 0,
      available_votes: 100, // Start with 100 votes for demo
      last_free_vote_claim: null,
      username: null,
      avatar_url: null
    };

    const { data: newUser, error: createError } = await supabase
      .from('users')
      .insert([newUserData])
      .select()
      .single();

    if (createError) {
      console.error('Error creating user:', createError);
      console.log('Trying direct method as fallback...');
      return await getOrCreateUserDirect(walletAddress, walletType);
    }

    console.log('Created new user:', newUser);
    return newUser as User;

  } catch (error) {
    console.error('Error creating user:', error);
    console.log('Trying direct method as final fallback...');
    return await getOrCreateUserDirect(walletAddress, walletType);
  }
};

// Update user profile
export const updateUser = async (
  walletAddress: string,
  updates: Partial<Pick<User, 'username' | 'avatar_url'>>
): Promise<User | null> => {
  try {
    // Set wallet context for RLS
    await setWalletContext(walletAddress);

    const { data, error } = await supabase
      .from('users')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('wallet_address', walletAddress)
      .select()
      .single();

    if (error) {
      console.error('Error updating user:', error);
      return null;
    }

    return data as User;
  } catch (error) {
    console.error('Error updating user:', error);
    return null;
  }
};

// Check if user can claim free votes (once per 24 hours)
export const canClaimFreeVotes = (user: User): boolean => {
  if (!user.last_free_vote_claim) {
    return true; // Never claimed before
  }
  
  const lastClaim = new Date(user.last_free_vote_claim);
  const now = new Date();
  const timeDiff = now.getTime() - lastClaim.getTime();
  const hoursDiff = timeDiff / (1000 * 3600);
  
  return hoursDiff >= 24;
};

// Claim free votes (update last claim timestamp and award votes)
export const claimFreeVotes = async (walletAddress: string, votesToAward: number = 10): Promise<boolean> => {
  try {
    // Set wallet context for RLS
    await setWalletContext(walletAddress);

    // 🎭 DEMO MODE: Award actual votes and update timestamp
    // First get current votes, then update
    const { data: currentUser } = await supabase
      .from('users')
      .select('available_votes')
      .eq('wallet_address', walletAddress)
      .single();
    
    const currentVotes = currentUser?.available_votes || 0;
    const newVoteTotal = currentVotes + votesToAward;
    
    const { error } = await supabase
      .from('users')
      .update({
        last_free_vote_claim: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        available_votes: newVoteTotal
      })
      .eq('wallet_address', walletAddress);

    if (error) {
      console.error('Error claiming free votes:', error);
      return false;
    }

    console.log(`🎁 Free votes claimed successfully! Awarded ${votesToAward} Licks.`);
    return true;
  } catch (error) {
    console.error('Error claiming free votes:', error);
    return false;
  }
}; 