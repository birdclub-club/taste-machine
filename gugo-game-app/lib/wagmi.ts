import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { abstractTestnet } from 'viem/chains';
import { abstractWallet } from '@abstract-foundation/agw-react/connectors';
import { metaMaskWallet } from '@rainbow-me/rainbowkit/wallets';

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
      wallets: [metaMaskWallet],
    },
  ],
  ssr: true,
}); 