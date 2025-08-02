import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { abstractTestnet, abstractMainnet } from 'viem/chains';
import { abstractWallet } from '@abstract-foundation/agw-react/connectors';

const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || 'demo-project-id';

// Get the appropriate chain based on environment
const chains = [
  process.env.NEXT_PUBLIC_CHAIN === 'mainnet' ? abstractMainnet : abstractTestnet,
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
  ],
  ssr: true,
}); 