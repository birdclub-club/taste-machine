"use client"

import { RainbowKitProvider, darkTheme, Theme } from '@rainbow-me/rainbowkit';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WagmiProvider } from 'wagmi';
import { config } from '../../lib/wagmi';
import { useEffect } from 'react';
import { MusicProvider } from '@/contexts/MusicContext';
import '@rainbow-me/rainbowkit/styles.css';

const queryClient = new QueryClient();

// Custom styles component for RainbowKit - force dynamic colors on connect button
function CustomRainbowKitStyles() {
  useEffect(() => {
    const style = document.createElement('style');
    style.id = 'custom-rainbowkit-styles';
    style.textContent = `
      /* Force Connect Wallet button to use dynamic palette */
      [data-rk] button[data-testid="rk-connect-button"] {
        background-color: var(--dynamic-text-color, #ffffff) !important;
        color: var(--dynamic-bg-color, #000000) !important;
        border: 1px solid var(--dynamic-text-color, #ffffff) !important;
      }
      
      /* Connect button hover state */
      [data-rk] button[data-testid="rk-connect-button"]:hover {
        background-color: var(--dynamic-text-color, #ffffff) !important;
        opacity: 0.9 !important;
      }
    `;
    
    // Remove existing style if it exists
    const existingStyle = document.getElementById('custom-rainbowkit-styles');
    if (existingStyle) {
      existingStyle.remove();
    }
    
    document.head.appendChild(style);
    
    return () => {
      const styleToRemove = document.getElementById('custom-rainbowkit-styles');
      if (styleToRemove) {
        styleToRemove.remove();
      }
    };
  }, []);
  
  return null;
}

// Custom RainbowKit theme - using default dark theme for readability
const customTheme = (): Theme => ({
  ...darkTheme(),
  colors: {
    ...darkTheme().colors,
    // Connect button uses landing page color palette
    connectButtonBackground: 'var(--dynamic-text-color, #ffffff)',
    connectButtonText: 'var(--dynamic-bg-color, #000000)',
    connectButtonInnerBackground: 'var(--dynamic-text-color, #ffffff)',
    // Modal styling with dynamic colors
    modalBorder: 'var(--dynamic-text-color, #ffffff)',
    connectionIndicator: 'var(--dynamic-accent-color, #00d395)',
    // Action buttons also use palette
    actionButtonBorder: 'var(--dynamic-text-color, #ffffff)',
    actionButtonBorderMobile: 'var(--dynamic-text-color, #ffffff)',
  },
  radii: {
    ...darkTheme().radii,
    actionButton: '50px',
    connectButton: '50px',
    menuButton: '50px',
    modal: '8px',
    modalMobile: '8px',
  },
});

// Global error handler for wallet connection rejections
function GlobalErrorHandler() {
  useEffect(() => {
    // Handle unhandled promise rejections (like wallet connection cancellations)
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      const error = event.reason;
      
      // Check if it's a user-initiated wallet cancellation
      if (
        error?.code === 4001 || // User rejected request
        error?.code === -32603 || // Internal error (often user cancellation)
        error?.message?.toLowerCase().includes('user rejected') ||
        error?.message?.toLowerCase().includes('user denied') ||
        error?.message?.toLowerCase().includes('user cancelled') ||
        error?.message?.toLowerCase().includes('connection request reset')
      ) {
        console.log('👋 User cancelled wallet connection - this is normal');
        event.preventDefault(); // Prevent the error from bubbling up
        return;
      }
      
      // Log other errors but don't crash the app
      console.warn('🔧 Unhandled promise rejection:', error);
      event.preventDefault();
    };

    // Handle uncaught errors
    const handleError = (event: ErrorEvent) => {
      const error = event.error;
      
      // Same wallet cancellation check for regular errors
      if (
        error?.code === 4001 ||
        error?.message?.toLowerCase().includes('user rejected') ||
        error?.message?.toLowerCase().includes('user denied') ||
        error?.message?.toLowerCase().includes('user cancelled')
      ) {
        console.log('👋 User cancelled wallet operation - this is normal');
        event.preventDefault();
        return;
      }
      
      console.warn('🔧 Uncaught error:', error);
    };

    window.addEventListener('unhandledrejection', handleUnhandledRejection);
    window.addEventListener('error', handleError);

    return () => {
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
      window.removeEventListener('error', handleError);
    };
  }, []);

  return null;
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider 
          theme={customTheme()}
          appInfo={{
            appName: 'Taste Machine',
            learnMoreUrl: 'https://abs.xyz',
          }}
        >
          <MusicProvider>
            <CustomRainbowKitStyles />
            <GlobalErrorHandler />
            {children}
          </MusicProvider>
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
} 