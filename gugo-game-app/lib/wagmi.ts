import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { abstractTestnet } from 'viem/chains';
import { abstractWallet } from '@abstract-foundation/agw-react/connectors';
import { metaMaskWallet, phantomWallet, coinbaseWallet } from '@rainbow-me/rainbowkit/wallets';

const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || 'demo-project-id';

// Get the appropriate chain based on environment
// Note: Abstract mainnet may not be available in viem/chains yet
const chains = [
  abstractTestnet, // Using testnet for now until mainnet is available
] as const;

export const config = getDefaultConfig({
  appName: 'Taste Machine',
  projectId,
  chains,
  wallets: [
    {
      groupName: 'Recommended',
      wallets: [abstractWallet],
    },
    {
      groupName: 'Popular',
      wallets: [metaMaskWallet, phantomWallet, coinbaseWallet],
    },
  ],
  ssr: true,
});

/*
 * 🔧 Note about browser wallet conflicts:
 * 
 * If you have both MetaMask and Phantom extensions installed, you may see
 * a secondary popup asking "Which extension do you want to connect with?"
 * 
 * This is NOT from RainbowKit - it's a browser-level conflict where both
 * wallet extensions try to inject into window.ethereum.
 * 
 * The app now gracefully handles users declining this popup without errors.
 * This behavior is expected and won't break the app.
 */ 