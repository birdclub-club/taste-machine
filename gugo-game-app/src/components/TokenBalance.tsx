"use client"

import { useTokenBalance } from '../hooks/useTokenBalance';

interface TokenBalanceProps {
  showRefreshButton?: boolean;
}

export default function TokenBalance({ 
  showRefreshButton = true 
}: TokenBalanceProps) {
  const { 
    eligibility, 
    loading, 
    error, 
    canPlayGame, 
    refreshBalance 
  } = useTokenBalance();

  if (loading) {
    return (
      <div className="flex flex-col gap-4 p-6 bg-gray-50 dark:bg-gray-800 rounded-lg border">
        <div className="flex items-center gap-2">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
          <p className="text-gray-600 dark:text-gray-300">Checking token balances and current prices...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col gap-4 p-6 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
        <div className="flex items-center gap-2">
          <span className="text-red-600">❌</span>
          <p className="text-red-600 dark:text-red-400">Token Balance Error: {error}</p>
        </div>
        {showRefreshButton && (
          <button
            onClick={refreshBalance}
            className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 transition-colors"
          >
            Retry
          </button>
        )}
      </div>
    );
  }

  if (!eligibility) {
    return (
      <div className="flex flex-col gap-4 p-6 bg-gray-50 dark:bg-gray-800 rounded-lg border">
        <p className="text-gray-600 dark:text-gray-300">Connect your wallet to check token balances</p>
      </div>
    );
  }

  const { ethBalance, gugoBalance, eligibilityReason, minimumRequirements } = eligibility;

  // Calculate current USD values
  const ethUsdValue = ethBalance ? Number(ethBalance.formattedBalance) * minimumRequirements.ethPrice : 0;
  const gugoUsdValue = gugoBalance ? Number(gugoBalance.formattedBalance) * minimumRequirements.gugoPrice : 0;

  return (
    <div className={`flex flex-col gap-4 p-6 rounded-lg border ${
      canPlayGame 
        ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
        : 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800'
    }`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="text-3xl">💰</div>
          <div>
                                <h3 className="text-lg font-semibold">Token Balances</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-300">
                      Live market pricing • $0.40 minimum for 10 votes
                    </p>
          </div>
        </div>
        {showRefreshButton && (
          <button
            onClick={refreshBalance}
            className="p-2 text-gray-500 hover:text-gray-700 transition-colors"
            title="Refresh balances and prices"
          >
            🔄
          </button>
        )}
      </div>

      {/* Price Info Banner */}
                    <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded border border-blue-200 dark:border-blue-700">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-medium text-blue-800 dark:text-blue-300">💱 Live Prices:</span>
                  <span className="text-xs text-blue-600 dark:text-blue-400">
                    Updated {new Date(minimumRequirements.lastUpdated).toLocaleTimeString()}
                  </span>
                </div>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div className="text-blue-700 dark:text-blue-300">
            ETH: ${minimumRequirements.ethPrice.toLocaleString()}
          </div>
          <div className="text-blue-700 dark:text-blue-300">
            GUGO: ${minimumRequirements.gugoPrice.toFixed(3)}
          </div>
        </div>
      </div>

      {/* Balance Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* ETH Balance */}
        <div className="bg-white dark:bg-gray-700 p-4 rounded-lg border">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-2xl">⚡</span>
            <div>
              <h4 className="font-semibold">Abstract ETH</h4>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {ethBalance?.name || 'Abstract Ethereum'}
              </p>
            </div>
          </div>
          <div className="text-right mb-2">
            <p className="text-xl font-bold text-gray-900 dark:text-gray-100">
              {ethBalance?.formattedBalance || '0.0000'}
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400">ETH</p>
            <p className="text-lg font-semibold text-green-600 dark:text-green-400">
              ${ethUsdValue.toFixed(2)}
            </p>
          </div>
          <div className="text-xs">
            <div className={`px-2 py-1 rounded mb-1 ${
              ethBalance && Number(ethBalance.formattedBalance) >= minimumRequirements.eth
                ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
            }`}>
              Need: {minimumRequirements.eth} ETH (${(minimumRequirements.eth * minimumRequirements.ethPrice).toFixed(2)})
            </div>
          </div>
        </div>

        {/* GUGO Balance */}
        <div className="bg-white dark:bg-gray-700 p-4 rounded-lg border">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-2xl">🪙</span>
            <div>
              <h4 className="font-semibold">GUGO Token</h4>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {gugoBalance?.name || 'GUGO'}
              </p>
            </div>
          </div>
          <div className="text-right mb-2">
            <p className="text-xl font-bold text-gray-900 dark:text-gray-100">
              {gugoBalance?.formattedBalance || '0'}
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {gugoBalance?.symbol || 'GUGO'}
            </p>
            <p className="text-lg font-semibold text-green-600 dark:text-green-400">
              ${gugoUsdValue.toFixed(2)}
            </p>
          </div>
          <div className="text-xs">
            <div className={`px-2 py-1 rounded mb-1 ${
              gugoBalance && Number(gugoBalance.formattedBalance) >= minimumRequirements.gugo
                ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
            }`}>
              Need: {minimumRequirements.gugo} {gugoBalance?.symbol || 'GUGO'} (${(minimumRequirements.gugo * minimumRequirements.gugoPrice).toFixed(2)})
            </div>
          </div>
        </div>
      </div>

      {/* Game Eligibility */}
      <div className={`p-4 rounded-lg border ${
        canPlayGame 
          ? 'bg-green-100 dark:bg-green-900/30 border-green-300 dark:border-green-700'
          : 'bg-orange-100 dark:bg-orange-900/30 border-orange-300 dark:border-orange-700'
      }`}>
        <div className="flex items-center gap-2 mb-2">
          <span className="text-2xl">{canPlayGame ? '🎮' : '⚠️'}</span>
          <h4 className="font-semibold">
            {canPlayGame ? 'Eligible to Play!' : 'Need More Tokens'}
          </h4>
        </div>
        
        <p className={`text-sm mb-2 ${
          canPlayGame 
            ? 'text-green-700 dark:text-green-300'
            : 'text-orange-700 dark:text-orange-300'
        }`}>
          {eligibilityReason}
        </p>

        {/* Vote Economics */}
        <div className="bg-white dark:bg-gray-700 p-3 rounded border text-xs">
          <h5 className="font-medium mb-1">💡 Vote Economics:</h5>
                              <ul className="space-y-1 text-gray-600 dark:text-gray-300">
                      <li>• Each vote costs $0.04 USD</li>
                      <li>• Minimum purchase: 10 votes = $0.40</li>
                      <li>• Pay with either ETH or GUGO tokens</li>
                      <li>• Prices update hourly with live market data</li>
                      <li>• Responsive pricing for fair market conditions</li>
                    </ul>
        </div>

        {!canPlayGame && (
          <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded border border-blue-200 dark:border-blue-700">
            <h5 className="font-medium text-blue-800 dark:text-blue-300 mb-1">How to get tokens:</h5>
            <ul className="text-xs text-blue-700 dark:text-blue-300 space-y-1">
              <li>• <strong>Abstract ETH:</strong> Bridge ETH to Abstract Chain using the official bridge</li>
              <li>• <strong>GUGO tokens:</strong> Check DEXs on Abstract Chain or community events</li>
              <li>• You only need <strong>$0.40 worth</strong> of either token to start playing!</li>
            </ul>
          </div>
        )}
      </div>

      {/* Technical Details (Collapsible) */}
      <details className="text-xs text-gray-500 dark:text-gray-400">
        <summary className="cursor-pointer hover:text-gray-700 dark:hover:text-gray-300">
          Technical Details
        </summary>
        <div className="mt-2 space-y-1">
          <p>GUGO Contract: {process.env.NEXT_PUBLIC_GUGO_CONTRACT}</p>
          <p>Chain: Abstract {process.env.NEXT_PUBLIC_CHAIN === 'mainnet' ? 'Mainnet' : 'Testnet'}</p>
          <p>Target USD Value: ${minimumRequirements.usdValue.toFixed(2)}</p>
          <p>Price Cache: {minimumRequirements.lastUpdated ? new Date(minimumRequirements.lastUpdated).toLocaleString() : 'Not available'}</p>
          {gugoBalance && (
            <>
              <p>GUGO Decimals: {gugoBalance.decimals}</p>
              <p>GUGO Raw Balance: {gugoBalance.balance}</p>
            </>
          )}
          {ethBalance && (
            <p>ETH Raw Balance: {ethBalance.balance}</p>
          )}
        </div>
      </details>
    </div>
  );
} 