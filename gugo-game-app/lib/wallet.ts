// Wallet connection logic for both AGW and Metamask
// Following the architecture pattern from architecture-rev1.md

import { BrowserProvider, JsonRpcSigner } from 'ethers';

export type WalletType = 'agw' | 'metamask';

export interface WalletInfo {
  address: string;
  type: WalletType;
  provider?: BrowserProvider;
  signer?: JsonRpcSigner;
}

// Abstract Chain network configuration
export const ABSTRACT_CHAIN_CONFIG = {
  testnet: {
    chainId: '0x2b74', // 11124 in hex
    chainName: 'Abstract Testnet',
    nativeCurrency: {
      name: 'ETH',
      symbol: 'ETH',
      decimals: 18,
    },
    rpcUrls: ['https://api.testnet.abs.xyz'],
    blockExplorerUrls: ['https://sepolia.abscan.org/'],
  },
  mainnet: {
    chainId: '0xab5', // 2741 in hex  
    chainName: 'Abstract',
    nativeCurrency: {
      name: 'ETH',
      symbol: 'ETH',
      decimals: 18,
    },
    rpcUrls: ['https://api.mainnet.abs.xyz'],
    blockExplorerUrls: ['https://abscan.org/'],
  }
};

// Check if Metamask is available
export const isMetamaskInstalled = (): boolean => {
  return typeof window !== 'undefined' && !!window.ethereum;
};

// Check if AGW is available (AGW uses the AbstractWalletProvider)
export const isAbstractWalletAvailable = (): boolean => {
  // AGW is available through the AbstractWalletProvider context
  // This will be properly implemented when we integrate with the useAccount hook
  return true;
};

// Add Abstract Chain to MetaMask
export const addAbstractChainToMetamask = async (): Promise<boolean> => {
  if (!isMetamaskInstalled() || !window.ethereum) {
    throw new Error('MetaMask is not installed');
  }

  const chainConfig = process.env.NEXT_PUBLIC_CHAIN === 'mainnet' 
    ? ABSTRACT_CHAIN_CONFIG.mainnet 
    : ABSTRACT_CHAIN_CONFIG.testnet;

  try {
    // Try to switch to Abstract chain
    await window.ethereum.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: chainConfig.chainId }],
    });
    return true;
  } catch (switchError: any) {
    // Chain doesn't exist, add it
    if (switchError.code === 4902) {
      try {
        await window.ethereum.request({
          method: 'wallet_addEthereumChain',
          params: [chainConfig],
        });
        return true;
      } catch (addError) {
        console.error('Failed to add Abstract chain:', addError);
        return false;
      }
    } else {
      console.error('Failed to switch to Abstract chain:', switchError);
      return false;
    }
  }
};

// Connect to Metamask (fallback wallet)
export const connectMetamask = async (): Promise<WalletInfo | null> => {
  if (!isMetamaskInstalled()) {
    throw new Error('MetaMask is not installed. Please install MetaMask to continue.');
  }

  try {
    // First, add/switch to Abstract chain
    const chainAdded = await addAbstractChainToMetamask();
    if (!chainAdded) {
      throw new Error('Failed to add Abstract chain to MetaMask');
    }

    // Request account access
    const provider = new BrowserProvider(window.ethereum);
    await provider.send("eth_requestAccounts", []);
    const signer = await provider.getSigner();
    const address = await signer.getAddress();

    // Verify we're on the correct chain
    const network = await provider.getNetwork();
    const expectedChainId = process.env.NEXT_PUBLIC_CHAIN === 'mainnet' ? 2741 : 11124;
    
    if (Number(network.chainId) !== expectedChainId) {
      throw new Error(`Please switch to Abstract ${process.env.NEXT_PUBLIC_CHAIN === 'mainnet' ? 'Mainnet' : 'Testnet'}`);
    }

    return {
      address,
      type: 'metamask',
      provider,
      signer,
    };
  } catch (error: any) {
    console.error('Failed to connect to MetaMask:', error);
    throw error;
  }
};

// Main wallet connection function (follows architecture pattern)
export const connectWallet = async (): Promise<WalletInfo | null> => {
  // Prefer AGW if available, fallback to Metamask
  if (isAbstractWalletAvailable()) {
    // AGW connection is handled by the useLoginWithAbstract hook
    // This function will be updated to work with AGW in the wallet integration tasks
    console.log('AGW preferred - use useLoginWithAbstract hook');
    return null;
  } else {
    return connectMetamask();
  }
};

// Get wallet balance (works with both AGW and MetaMask)
export const getWalletBalance = async (address: string, provider?: BrowserProvider): Promise<string> => {
  try {
    if (!provider) {
      // Create a read-only provider for Abstract chain
      const rpcUrl = process.env.NEXT_PUBLIC_CHAIN === 'mainnet' 
        ? 'https://api.mainnet.abs.xyz'
        : 'https://api.testnet.abs.xyz';
      
      provider = new BrowserProvider({
        request: async ({ method, params }: any) => {
          const response = await fetch(rpcUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              jsonrpc: '2.0',
              method,
              params,
              id: 1,
            }),
          });
          const data = await response.json();
          return data.result;
        }
      } as any);
    }

    const balance = await provider.getBalance(address);
    return balance.toString();
  } catch (error) {
    console.error('Error fetching balance:', error);
    return '0';
  }
};

 