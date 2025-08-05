import { BrowserProvider, Contract, formatUnits, formatEther } from 'ethers';

// Extend window interface for ethereum provider
declare global {
  interface Window {
    ethereum?: {
      request: (args: { method: string; params?: any[] }) => Promise<any>;
      on: (event: string, handler: (...args: any[]) => void) => void;
      removeListener: (event: string, handler: (...args: any[]) => void) => void;
      isMetaMask?: boolean;
    };
  }
}

// FGUGO token contract on Abstract Testnet (Fake GUGO for development)
const GUGO_CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_GUGO_CONTRACT || '0x3eAd960365697E1809683617af9390ABC9C24E56';

// Standard ERC-20 ABI for balance checking
const ERC20_ABI = [
  // balanceOf
  'function balanceOf(address owner) view returns (uint256)',
  // decimals
  'function decimals() view returns (uint8)',
  // name
  'function name() view returns (string)',
  // symbol
  'function symbol() view returns (string)',
  // totalSupply
  'function totalSupply() view returns (uint256)'
];

// Abstract Chain RPC URLs
const ABSTRACT_RPC_URLS = {
  testnet: 'https://api.testnet.abs.xyz',
  mainnet: 'https://api.mainnet.abs.xyz'
};

// Pricing constants
const VOTE_PRICE_USD = 0.04; // $0.04 per vote
const MINIMUM_VOTES = 10; // 10 votes minimum
const TARGET_USD_VALUE = VOTE_PRICE_USD * MINIMUM_VOTES; // $0.40 total

// Price data interfaces
export interface PriceData {
  ethUsd: number;
  gugoUsd: number;
  lastUpdated: number;
  source: string;
}

export interface MinimumRequirements {
  eth: number;
  gugo: number;
  usdValue: number;
  lastUpdated: number;
  ethPrice: number;
  gugoPrice: number;
}

export interface TokenBalance {
  balance: string; // Raw balance as string
  formattedBalance: string; // Human-readable balance (e.g., "100.5")
  decimals: number;
  symbol: string;
  name: string;
  hasTokens: boolean; // Helper boolean for game logic
}

export interface GameEligibility {
  canPlay: boolean;
  ethBalance: TokenBalance | null;
  gugoBalance: TokenBalance | null;
  eligibilityReason: string;
  minimumRequirements: MinimumRequirements;
}

// Cache for price data (hourly updates for responsive pricing)
let priceCache: { data: PriceData | null; timestamp: number } = { data: null, timestamp: 0 };
const PRICE_CACHE_DURATION = 60 * 60 * 1000; // 1 hour in milliseconds

// Fetch current ETH/USD price (live market data)
export const fetchEthPrice = async (): Promise<number> => {
  try {
    console.log('💰 Fetching live ETH/USD price from CryptoCompare...');
    
    const response = await fetch(
      'https://min-api.cryptocompare.com/data/price?fsym=ETH&tsyms=USD'
    );
    
    if (!response.ok) {
      throw new Error(`CryptoCompare API error: ${response.statusText}`);
    }
    
    const data = await response.json();
    
    if (data.USD && data.USD > 0) {
      console.log('✅ Live ETH/USD price:', data.USD);
      return data.USD;
    } else {
      throw new Error('Invalid ETH price data received');
    }
    
  } catch (error) {
    console.error('❌ Error fetching ETH price:', error);
    // Conservative fallback
    const fallbackPrice = 3200; // ~$3200 USD as fallback
    console.log(`🔄 Using fallback ETH price: $${fallbackPrice}`);
    return fallbackPrice;
  }
};

// Fetch live GUGO/USD price (real market data)
export const fetchGugoPrice = async (): Promise<number> => {
  try {
    console.log('🪙 Fetching live GUGO/USD price...');
    
    // For both testnet and mainnet, we use live GUGO market price
    // This ensures responsive pricing that reflects real market conditions
    
    try {
      // Method 1: Try live price from CryptoCompare
      const cryptoCompareResponse = await fetch(
        'https://min-api.cryptocompare.com/data/price?fsym=GUGO&tsyms=USD'
      );
      
      if (cryptoCompareResponse.ok) {
        const data = await cryptoCompareResponse.json();
        if (data.USD && data.USD > 0) {
          const price = data.USD;
          console.log('✅ Live GUGO price from CryptoCompare:', price);
          return price;
        }
      }
    } catch (error) {
      console.log('⚠️ CryptoCompare lookup failed, trying alternative sources...');
    }
    
    try {
      // Method 2: Try CoinGecko live price (if GUGO is listed)
      const coingeckoResponse = await fetch(
        'https://api.coingecko.com/api/v3/simple/price?ids=gugo&vs_currencies=usd'
      );
      
      if (coingeckoResponse.ok) {
        const data = await coingeckoResponse.json();
        if (data.gugo?.usd) {
          const price = data.gugo.usd;
          console.log('✅ Live GUGO price from CoinGecko:', price);
          return price;
        }
      }
    } catch (error) {
      console.log('⚠️ CoinGecko lookup failed...');
    }
    
    try {
      // Method 3: Try Abstract Chain DEX price (live)
      const dexPrice = await fetchGugoFromDEX();
      if (dexPrice > 0) {
        console.log('✅ Live GUGO price from DEX:', dexPrice);
        return dexPrice;
      }
    } catch (error) {
      console.log('⚠️ DEX price lookup failed...');
    }
    
    // Method 4: Use current market estimate
    // TODO: Connect to real GUGO trading pairs when available
    const estimatedPrice = 0.2; // $0.2 - Updated Thu Jul 31 2025
    console.log('🔄 Using estimated GUGO price (needs real market data):', estimatedPrice);
    console.log('💡 Update this with actual GUGO market price from DEX or CEX');
    
    return estimatedPrice;
    
  } catch (error) {
    console.error('❌ Error fetching GUGO price:', error);
    
    // Conservative fallback that should be updated
    const fallbackPrice = 0.005; // $0.005 fallback
    console.log(`🔄 Using fallback GUGO price: $${fallbackPrice}`);
    console.log('⚠️ This should be updated with real market data');
    
    return fallbackPrice;
  }
};

// Helper function to fetch GUGO price from DEX
async function fetchGugoFromDEX(): Promise<number> {
  try {
    // This would integrate with Abstract Chain DEX aggregators
    // Examples: 1inch API, Uniswap V3 subgraph, SushiSwap API
    
    // For Abstract Chain, you'd query something like:
    // - Abstract's native DEXs
    // - Uniswap V3 deployments on Abstract
    // - DEX aggregators that support Abstract
    
    const gugoContractAddress = GUGO_CONTRACT_ADDRESS;
    const wethAddress = '0x4200000000000000000000000000000000000006'; // WETH on Abstract
    
    // Example query structure (would need actual DEX API endpoint):
    // const dexResponse = await fetch(
    //   `https://abstract-dex-api.com/quote?` +
    //   `sellToken=${gugoContractAddress}&` +
    //   `buyToken=${wethAddress}&` +
    //   `sellAmount=1000000000000000000` // 1 GUGO in wei
    // );
    
    // For now, return 0 to indicate no price found
    // This should be implemented with actual DEX integration
    console.log('🔄 DEX price lookup not yet implemented for Abstract Chain');
    return 0;
    
  } catch (error) {
    console.log('❌ DEX price fetch error:', error);
    return 0;
  }
}

// Get current price data with caching
export const getCurrentPrices = async (): Promise<PriceData> => {
  const now = Date.now();
  
  // Return cached data if still fresh
  if (priceCache.data && (now - priceCache.timestamp) < PRICE_CACHE_DURATION) {
    console.log('📋 Using cached price data');
    return priceCache.data;
  }
  
  console.log('🔄 Fetching fresh price data...');
  
  // Fetch both prices in parallel
  const [ethUsd, gugoUsd] = await Promise.all([
    fetchEthPrice(),
    fetchGugoPrice()
  ]);
  
  const priceData: PriceData = {
    ethUsd,
    gugoUsd,
    lastUpdated: now,
    source: 'CryptoCompare + DEX'
  };
  
  // Update cache
  priceCache = { data: priceData, timestamp: now };
  
  console.log('✅ Price data updated:', priceData);
  return priceData;
};

// Calculate minimum token requirements based on USD target
export const calculateMinimumRequirements = async (): Promise<MinimumRequirements> => {
  try {
    console.log(`🎯 Calculating minimum requirements for $${TARGET_USD_VALUE} USD...`);
    
    const prices = await getCurrentPrices();
    
    // Calculate minimum tokens needed
    const minimumEth = TARGET_USD_VALUE / prices.ethUsd;
    const minimumGugo = TARGET_USD_VALUE / prices.gugoUsd;
    
    // Round to reasonable numbers
    const roundedEth = Math.ceil(minimumEth * 10000) / 10000; // 4 decimal places
    const roundedGugo = Math.ceil(minimumGugo); // Whole numbers for GUGO
    
    const requirements: MinimumRequirements = {
      eth: roundedEth,
      gugo: roundedGugo,
      usdValue: TARGET_USD_VALUE,
      lastUpdated: prices.lastUpdated,
      ethPrice: prices.ethUsd,
      gugoPrice: prices.gugoUsd
    };
    
    console.log('📊 Minimum requirements calculated:');
    console.log(`  ETH: ${roundedEth} (≈$${(roundedEth * prices.ethUsd).toFixed(2)})`);
    console.log(`  GUGO: ${roundedGugo} (≈$${(roundedGugo * prices.gugoUsd).toFixed(2)})`);
    
    return requirements;
    
  } catch (error) {
    console.error('❌ Error calculating minimum requirements:', error);
    
    // Fallback to conservative defaults
    return {
      eth: 0.0002, // Conservative ETH amount
      gugo: 40, // Conservative GUGO amount  
      usdValue: TARGET_USD_VALUE,
      lastUpdated: Date.now(),
      ethPrice: 3200, // Fallback prices
      gugoPrice: 0.01
    };
  }
};

// Create provider - prioritize user's wallet provider over direct RPC
const createProvider = async (): Promise<BrowserProvider> => {
  // First, try to use the user's connected wallet (MetaMask, etc.)
  if (typeof window !== 'undefined' && window.ethereum) {
    try {
      const provider = new BrowserProvider(window.ethereum);
      const network = await provider.getNetwork();
      
      // Check if connected to Abstract Testnet (Chain ID: 11124)
      if (network.chainId === BigInt(11124)) {
        console.log('✅ Using wallet provider on Abstract Testnet');
        return provider;
      } else {
        console.log(`⚠️ Wallet connected to chain ${network.chainId}, need Abstract Testnet (11124)`);
        // Try to switch to Abstract Testnet
        try {
          await window.ethereum.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: '0x2B74' }], // 11124 in hex
          });
          console.log('✅ Switched to Abstract Testnet');
          return new BrowserProvider(window.ethereum);
        } catch (switchError: any) {
          if (switchError.code === 4902) {
            // Chain not added to wallet, add it
            await window.ethereum.request({
              method: 'wallet_addEthereumChain',
              params: [{
                chainId: '0x2B74',
                chainName: 'Abstract Testnet',
                nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
                rpcUrls: ['https://api.testnet.abs.xyz'],
                blockExplorerUrls: ['https://explorer.testnet.abs.xyz']
              }]
            });
            return new BrowserProvider(window.ethereum);
          } else {
            throw switchError;
          }
        }
      }
    } catch (error) {
      console.log('⚠️ Error using wallet provider, falling back to direct RPC:', error);
    }
  }
  
  // Fallback: Create custom provider for direct RPC calls
  const chain = process.env.NEXT_PUBLIC_CHAIN || 'testnet';
  const rpcUrl = ABSTRACT_RPC_URLS[chain as keyof typeof ABSTRACT_RPC_URLS];
  
  console.log('🔄 Using direct RPC provider:', rpcUrl);
  
  return new BrowserProvider({
    request: async ({ method, params }: any) => {
      const response = await fetch(rpcUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method,
          params,
          id: Date.now(),
        }),
      });
      
      if (!response.ok) {
        throw new Error(`RPC request failed: ${response.statusText}`);
      }
      
      const data = await response.json();
      if (data.error) {
        throw new Error(data.error.message);
      }
      
      return data.result;
    }
  } as any);
};

// Get Abstract ETH balance
export const getAbstractEthBalance = async (walletAddress: string): Promise<TokenBalance | null> => {
  try {
    console.log('⚡ Checking Abstract ETH balance for:', walletAddress);
    
    const provider = await createProvider();
    const balance = await provider.getBalance(walletAddress);
    
    // Format the balance for human reading (ETH has 18 decimals)
    const formattedBalance = formatEther(balance);
    const hasTokens = Number(formattedBalance) > 0;
    
    const chain = process.env.NEXT_PUBLIC_CHAIN || 'testnet';
    const ethName = chain === 'mainnet' ? 'Abstract ETH' : 'Abstract Testnet ETH';
    
    console.log('⚡ ETH balance:', formattedBalance, 'ETH');
    console.log('⚡ Has ETH for game:', hasTokens);

    return {
      balance: balance.toString(),
      formattedBalance,
      decimals: 18,
      symbol: 'ETH',
      name: ethName,
      hasTokens
    };

  } catch (error) {
    console.error('❌ Error fetching Abstract ETH balance:', error);
    return null;
  }
};

// Get GUGO token balance for a wallet address
export const getGugoTokenBalance = async (walletAddress: string): Promise<TokenBalance | null> => {
  try {
    console.log('🪙 Checking GUGO token balance for:', walletAddress);
    
    const provider = await createProvider();
    
    console.log('🌐 Using Abstract Chain:', process.env.NEXT_PUBLIC_CHAIN || 'testnet');

    // Create contract instance
    const contract = new Contract(GUGO_CONTRACT_ADDRESS, ERC20_ABI, provider);
    
    // Fetch token info in parallel
    const [balance, decimals, symbol, name] = await Promise.all([
      contract.balanceOf(walletAddress),
      contract.decimals(),
      contract.symbol(),
      contract.name()
    ]);

    console.log('📊 Token info:', { name, symbol, decimals: Number(decimals) });
    console.log('💰 Raw balance:', balance.toString());

    // Format the balance for human reading
    const formattedBalance = formatUnits(balance, decimals);
    const hasTokens = Number(formattedBalance) > 0;

    console.log('✨ Formatted balance:', formattedBalance, symbol);
    console.log('🎮 Has tokens for game:', hasTokens);

    return {
      balance: balance.toString(),
      formattedBalance,
      decimals: Number(decimals),
      symbol,
      name,
      hasTokens
    };

  } catch (error) {
    console.error('❌ Error fetching GUGO token balance:', error);
    return null;
  }
};

// Check game eligibility with dynamic pricing
export const checkGameEligibility = async (walletAddress: string): Promise<GameEligibility> => {
  try {
    console.log('🎯 Checking game eligibility for:', walletAddress);
    
    // Get current minimum requirements based on live prices
    const minimumRequirements = await calculateMinimumRequirements();
    
    console.log('📋 Dynamic requirements:');
    console.log(`  ETH: ${minimumRequirements.eth} (≈$${(minimumRequirements.eth * minimumRequirements.ethPrice).toFixed(2)})`);
    console.log(`  GUGO: ${minimumRequirements.gugo} (≈$${(minimumRequirements.gugo * minimumRequirements.gugoPrice).toFixed(2)})`);
    
    // Check both balances in parallel
    const [ethBalance, gugoBalance] = await Promise.all([
      getAbstractEthBalance(walletAddress),
      getGugoTokenBalance(walletAddress)
    ]);

    let canPlay = false;
    let eligibilityReason = '';

    // Check if balances meet dynamic requirements
    const hasEnoughEth = ethBalance && Number(ethBalance.formattedBalance) >= minimumRequirements.eth;
    const hasEnoughGugo = gugoBalance && Number(gugoBalance.formattedBalance) >= minimumRequirements.gugo;

    const ethUsdValue = ethBalance ? Number(ethBalance.formattedBalance) * minimumRequirements.ethPrice : 0;
    const gugoUsdValue = gugoBalance ? Number(gugoBalance.formattedBalance) * minimumRequirements.gugoPrice : 0;

    if (hasEnoughEth && hasEnoughGugo) {
      canPlay = true;
      eligibilityReason = `You have ${ethBalance.formattedBalance} ETH ($${ethUsdValue.toFixed(2)}) and ${gugoBalance.formattedBalance} ${gugoBalance.symbol} ($${gugoUsdValue.toFixed(2)}) - both meet the $${TARGET_USD_VALUE.toFixed(2)} requirement!`;
    } else if (hasEnoughEth) {
      canPlay = true;
      eligibilityReason = `You have ${ethBalance.formattedBalance} ETH ($${ethUsdValue.toFixed(2)}) which meets the minimum requirement of $${TARGET_USD_VALUE.toFixed(2)}.`;
    } else if (hasEnoughGugo) {
      canPlay = true;
      eligibilityReason = `You have ${gugoBalance.formattedBalance} ${gugoBalance.symbol} ($${gugoUsdValue.toFixed(2)}) which meets the minimum requirement of $${TARGET_USD_VALUE.toFixed(2)}.`;
    } else {
      canPlay = false;
      const ethMsg = ethBalance 
        ? `${ethBalance.formattedBalance} ETH ($${ethUsdValue.toFixed(2)}, need $${(minimumRequirements.eth * minimumRequirements.ethPrice).toFixed(2)})` 
        : 'Unable to check ETH';
      const gugoMsg = gugoBalance 
        ? `${gugoBalance.formattedBalance} ${gugoBalance.symbol} ($${gugoUsdValue.toFixed(2)}, need $${(minimumRequirements.gugo * minimumRequirements.gugoPrice).toFixed(2)})` 
        : 'Unable to check GUGO';
      eligibilityReason = `Insufficient tokens. You have: ${ethMsg} and ${gugoMsg}. You need at least $${TARGET_USD_VALUE.toFixed(2)} worth of ETH OR GUGO tokens (≈${minimumRequirements.eth} ETH or ${minimumRequirements.gugo} GUGO).`;
    }

    console.log('🎮 Game eligibility result:', canPlay);
    console.log('📝 Reason:', eligibilityReason);

    return {
      canPlay,
      ethBalance,
      gugoBalance,
      eligibilityReason,
      minimumRequirements
    };

  } catch (error) {
    console.error('❌ Error checking game eligibility:', error);
    
    // Fallback requirements
    const fallbackRequirements: MinimumRequirements = {
      eth: 0.0002,
      gugo: 40,
      usdValue: TARGET_USD_VALUE,
      lastUpdated: Date.now(),
      ethPrice: 3200,
      gugoPrice: 0.01
    };
    
    return {
      canPlay: false,
      ethBalance: null,
      gugoBalance: null,
      eligibilityReason: 'Error checking token balances - please try again',
      minimumRequirements: fallbackRequirements
    };
  }
};

// Legacy function for backward compatibility - now uses dynamic pricing
export const hasRequiredTokensForGame = async (walletAddress: string): Promise<boolean> => {
  const eligibility = await checkGameEligibility(walletAddress);
  return eligibility.canPlay;
};

// Get token info without balance (useful for displaying token details)
export const getGugoTokenInfo = async (): Promise<Omit<TokenBalance, 'balance' | 'formattedBalance' | 'hasTokens'> | null> => {
  try {
    const provider = await createProvider();
    const contract = new Contract(GUGO_CONTRACT_ADDRESS, ERC20_ABI, provider);
    
    const [decimals, symbol, name] = await Promise.all([
      contract.decimals(),
      contract.symbol(),
      contract.name()
    ]);

    return {
      decimals: Number(decimals),
      symbol,
      name
    };
  } catch (error) {
    console.error('❌ Error fetching GUGO token info:', error);
    return null;
  }
}; 