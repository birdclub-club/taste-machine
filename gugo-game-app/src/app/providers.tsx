"use client"

import { RainbowKitProvider, darkTheme } from '@rainbow-me/rainbowkit';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WagmiProvider } from 'wagmi';
import { config } from '../../lib/wagmi';
import { useEffect } from 'react';
import '@rainbow-me/rainbowkit/styles.css';

const queryClient = new QueryClient();

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
          theme={darkTheme()}
          appInfo={{
            appName: 'Taste Machine',
            learnMoreUrl: 'https://abs.xyz',
          }}
        >
          <GlobalErrorHandler />
          {children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
} 