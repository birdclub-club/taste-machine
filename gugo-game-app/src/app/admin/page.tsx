'use client';

import React, { useState } from 'react';
import CollectionManager from '@/components/CollectionManager';
import UserStatsDisplay from '@/components/UserStatsDisplay';
import AnalyticsChartsSimple from '@/components/AnalyticsChartsSimple';
import { useAdmin } from '@/hooks/useAdmin';
import { useAuth } from '@/hooks/useAuth';
import { ConnectButton } from '@rainbow-me/rainbowkit';

interface GugoTreasuryData {
  prizeBreakTreasury: number;
  weeklyRaffleTreasury: number;
  legacyTreasury: number;
  operationsWalletBalance: number;
  burnWalletBalance: number;
  contractBalance: number;
  totalSupply: number;
  totalRewarded: number;
  totalBurned: number;
  totalAllocated: number;
  treasuryHealthPercent: number;
  burnRatePercent: number;
  rewardRatePercent: number;
  revenueToday: number;
  revenueAllTime: number;
  newUsersToday?: number;
  totalUsers?: number;
  status: 'live' | 'simulated';
  timestamp: string;
}

export default function AdminPage() {
  const [currentTab, setCurrentTab] = useState<'collections' | 'analytics' | 'settings'>('collections');
  const { user, loading } = useAuth();
  const { isAdmin: isUserAdmin, adminRole, walletAddress } = useAdmin();
  const [treasuryData, setTreasuryData] = useState<GugoTreasuryData | null>(null);
  const [treasuryLoading, setTreasuryLoading] = useState(false);

  // Fetch GUGO treasury data
  const fetchTreasuryData = async () => {
    if (!isUserAdmin) return;
    
    setTreasuryLoading(true);
    try {
      const response = await fetch(`/api/admin/gugo-treasury?wallet=${walletAddress}`, {
        headers: {
          'x-wallet-address': walletAddress || ''
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setTreasuryData(data);
        console.log('✅ Treasury data loaded:', data.status);
      } else {
        console.error('❌ Failed to fetch treasury data:', response.status);
      }
    } catch (error) {
      console.error('❌ Treasury data fetch error:', error);
    } finally {
      setTreasuryLoading(false);
    }
  };

  // Load treasury data when admin panel opens
  React.useEffect(() => {
    if (isUserAdmin && currentTab === 'analytics') {
      fetchTreasuryData();
    }
  }, [isUserAdmin, currentTab]);

  // Show loading state while checking authentication
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto mb-4"></div>
          <p className="text-gray-600">Checking authentication...</p>
        </div>
      </div>
    );
  }

  // Show wallet connection prompt if not connected
  if (!user) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="max-w-md mx-auto text-center bg-white rounded-lg shadow-lg p-8">
          <div className="text-6xl mb-4">🔐</div>
          <h1 className="text-2xl font-bold text-gray-900 mb-4">
            Admin Access Required
          </h1>
          <p className="text-gray-600 mb-6">
            Please connect your wallet to access the admin panel.
          </p>
          <ConnectButton />
        </div>
      </div>
    );
  }

  // Show access denied if not admin
  if (!isUserAdmin) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="max-w-md mx-auto text-center bg-white rounded-lg shadow-lg p-8">
          <div className="text-6xl mb-4">🚫</div>
          <h1 className="text-2xl font-bold text-gray-900 mb-4">
            Access Denied
          </h1>
          <p className="text-gray-600 mb-4">
            Your wallet address is not authorized for admin access.
          </p>
          <p className="text-sm text-gray-500 mb-6">
            Connected: {walletAddress?.slice(0, 6)}...{walletAddress?.slice(-4)}
          </p>
          <ConnectButton />
        </div>
      </div>
    );
  }

  // Render admin panel for authorized users
  return (
    <div className="min-h-screen bg-gray-100 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Header */}
        <div className="mb-8">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                🎛️ Taste Machine Admin
              </h1>
              <p className="text-gray-600 mt-2">
                Manage collections, priorities, and system settings
              </p>
            </div>
            <div className="text-right">
              <div className="bg-green-100 border border-green-300 rounded-lg px-4 py-2">
                <div className="text-sm font-medium text-green-800">
                  🔐 Admin Access Granted
                </div>
                <div className="text-xs text-green-600 mt-1">
                  Role: {adminRole} • {walletAddress?.slice(0, 6)}...{walletAddress?.slice(-4)}
                </div>
              </div>
              <div className="mt-2">
                <ConnectButton />
              </div>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="mb-6">
          <nav className="flex space-x-8">
            <button
              onClick={() => setCurrentTab('collections')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                currentTab === 'collections'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              📊 Collection Management
            </button>
                        <button
              onClick={() => setCurrentTab('analytics')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                currentTab === 'analytics'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              📊 Analytics
            </button>
            <button
              onClick={() => setCurrentTab('settings')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                currentTab === 'settings'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              ⚙️ System Settings
            </button>
          </nav>
        </div>

        {/* Tab Content */}
        <div className="mb-8">
          {currentTab === 'collections' && (
            <CollectionManager />
          )}
          
          {currentTab === 'analytics' && (
            <div className="space-y-6">
              <UserStatsDisplay />
              
              {/* GUGO Treasury Analytics */}
              <div className="bg-white rounded-lg shadow-lg p-6">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-xl font-bold text-gray-900">
                    💰 GUGO Treasury Analytics
                  </h2>
                  <button
                    onClick={fetchTreasuryData}
                    disabled={treasuryLoading}
                    className="bg-blue-500 hover:bg-blue-600 disabled:bg-gray-400 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                  >
                    {treasuryLoading ? '🔄 Loading...' : '🔄 Refresh'}
                  </button>
                </div>

                {treasuryLoading ? (
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-4"></div>
                    <p className="text-gray-600">Loading treasury data...</p>
                  </div>
                ) : treasuryData ? (
                  <div className="space-y-6">
                    {/* Status Badge */}
                    <div className="flex items-center gap-2 mb-4">
                      <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                        treasuryData.status === 'live' 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-yellow-100 text-yellow-800'
                      }`}>
                        {treasuryData.status === 'live' ? '🟢 Live Data' : '🟡 Simulated Data'}
                      </span>
                      <span className="text-xs text-gray-500">
                        Updated: {new Date(treasuryData.timestamp).toLocaleString()}
                      </span>
                    </div>

                    {/* Treasury Balances Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                      <div className="bg-gradient-to-r from-green-50 to-green-100 p-4 rounded-lg border border-green-200">
                        <h3 className="text-sm font-medium text-green-800 mb-1">Prize Break Treasury</h3>
                        <p className="text-2xl font-bold text-green-900">{treasuryData.prizeBreakTreasury.toLocaleString()}</p>
                        <p className="text-xs text-green-600">GUGO available for daily prizes</p>
                      </div>
                      
                      <div className="bg-gradient-to-r from-blue-50 to-blue-100 p-4 rounded-lg border border-blue-200">
                        <h3 className="text-sm font-medium text-blue-800 mb-1">Weekly Raffle Treasury</h3>
                        <p className="text-2xl font-bold text-blue-900">{treasuryData.weeklyRaffleTreasury.toLocaleString()}</p>
                        <p className="text-xs text-blue-600">GUGO for weekly big prizes</p>
                      </div>
                      
                      <div className="bg-gradient-to-r from-purple-50 to-purple-100 p-4 rounded-lg border border-purple-200">
                        <h3 className="text-sm font-medium text-purple-800 mb-1">Operations Wallet</h3>
                        <p className="text-2xl font-bold text-purple-900">{treasuryData.operationsWalletBalance.toLocaleString()}</p>
                        <p className="text-xs text-purple-600">GUGO for business expenses</p>
                      </div>
                      
                      <div className="bg-gradient-to-r from-red-50 to-red-100 p-4 rounded-lg border border-red-200">
                        <h3 className="text-sm font-medium text-red-800 mb-1">Burned GUGO</h3>
                        <p className="text-2xl font-bold text-red-900">{treasuryData.totalBurned.toLocaleString()}</p>
                        <p className="text-xs text-red-600">GUGO permanently removed</p>
                      </div>
                    </div>

                    {/* Revenue Metrics */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                      <div className="bg-gradient-to-r from-emerald-50 to-emerald-100 p-4 rounded-lg border border-emerald-200">
                        <h3 className="text-sm font-medium text-emerald-800 mb-1">💵 Revenue Today</h3>
                        <p className="text-2xl font-bold text-emerald-900">${treasuryData.revenueToday.toFixed(2)}</p>
                        <p className="text-xs text-emerald-600">
                          {treasuryData.newUsersToday ? `+${treasuryData.newUsersToday} new users` : 'Daily earnings'}
                        </p>
                      </div>
                      
                      <div className="bg-gradient-to-r from-indigo-50 to-indigo-100 p-4 rounded-lg border border-indigo-200">
                        <h3 className="text-sm font-medium text-indigo-800 mb-1">💰 Revenue All Time</h3>
                        <p className="text-2xl font-bold text-indigo-900">${treasuryData.revenueAllTime.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</p>
                        <p className="text-xs text-indigo-600">
                          {treasuryData.totalUsers ? `${treasuryData.totalUsers} total users` : 'Total earnings'}
                        </p>
                      </div>
                    </div>

                    {/* Key Metrics */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                      <div className="bg-gray-50 p-4 rounded-lg border">
                        <h3 className="text-sm font-medium text-gray-700 mb-1">Total Rewarded</h3>
                        <p className="text-xl font-bold text-gray-900">{treasuryData.totalRewarded.toLocaleString()}</p>
                        <p className="text-xs text-gray-600">{treasuryData.rewardRatePercent.toFixed(1)}% of total supply</p>
                      </div>
                      
                      <div className="bg-gray-50 p-4 rounded-lg border">
                        <h3 className="text-sm font-medium text-gray-700 mb-1">Treasury Health</h3>
                        <p className="text-xl font-bold text-gray-900">{treasuryData.treasuryHealthPercent.toFixed(1)}%</p>
                        <p className="text-xs text-gray-600">Prize treasury vs total supply</p>
                      </div>
                      
                      <div className="bg-gray-50 p-4 rounded-lg border">
                        <h3 className="text-sm font-medium text-gray-700 mb-1">Total Supply</h3>
                        <p className="text-xl font-bold text-gray-900">{treasuryData.totalSupply.toLocaleString()}</p>
                        <p className="text-xs text-gray-600">Total GUGO tokens</p>
                      </div>
                    </div>

                    {/* Contract Information */}
                    <div className="bg-gray-50 p-4 rounded-lg border">
                      <h3 className="text-sm font-medium text-gray-700 mb-3">📋 Contract Information</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                        <div>
                          <span className="font-medium">Contract Balance:</span>
                          <span className="ml-2">{treasuryData.contractBalance.toLocaleString()} GUGO</span>
                        </div>
                        <div>
                          <span className="font-medium">Burn Rate:</span>
                          <span className="ml-2">{treasuryData.burnRatePercent.toFixed(1)}%</span>
                        </div>
                        <div>
                          <span className="font-medium">Legacy Treasury:</span>
                          <span className="ml-2">{treasuryData.legacyTreasury.toLocaleString()} GUGO</span>
                        </div>
                        <div>
                          <span className="font-medium">Total Allocated:</span>
                          <span className="ml-2">{treasuryData.totalAllocated.toLocaleString()} GUGO</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <p className="text-gray-600 mb-4">No treasury data available</p>
                    <button
                      onClick={fetchTreasuryData}
                      className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium"
                    >
                      Load Treasury Data
                    </button>
                  </div>
                )}
              </div>
              
              {/* Time Series Charts */}
              <AnalyticsChartsSimple />
              
              {/* Additional Analytics Sections */}
              <div className="bg-white rounded-lg shadow-lg p-6">
                <h2 className="text-xl font-bold text-gray-900 mb-4">
                  📈 System Analytics
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  
                  {/* Vote Activity */}
                  <div className="border-l-4 border-green-500 pl-4">
                    <h3 className="font-medium text-gray-900 mb-2">
                      🗳️ Vote Activity
                    </h3>
                    <div className="text-sm text-gray-600 space-y-1">
                      <div>📊 Daily votes tracked via API</div>
                      <div>⚡ Real-time vote processing</div>
                      <div>🎯 Enhanced matchup success rate monitoring</div>
                      <div>📈 User engagement metrics</div>
                    </div>
                  </div>

                  {/* Performance Insights */}
                  <div className="border-l-4 border-blue-500 pl-4">
                    <h3 className="font-medium text-gray-900 mb-2">
                      🚀 Performance Insights
                    </h3>
                    <div className="text-sm text-gray-600 space-y-1">
                      <div>⏱️ Session preload: ~676ms per session</div>
                      <div>🧠 Enhanced system: 30% usage</div>
                      <div>🔄 Legacy fallback: 70% usage</div>
                      <div>✅ System reliability: 99%+</div>
                    </div>
                  </div>

                </div>
                
                {/* Historical Data Setup */}
                <div className="mt-6 pt-4 border-t border-gray-200">
                  <h3 className="font-medium text-gray-900 mb-3">📊 Historical Data Tracking</h3>
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <div className="flex items-start">
                      <div className="text-blue-400 mr-3 mt-1">💡</div>
                      <div>
                        <h4 className="text-blue-800 font-medium">Enable Real Historical Tracking</h4>
                        <p className="text-blue-600 text-sm mt-1">
                          Run the analytics migration to enable automatic daily snapshots and replace mock data with real historical tracking.
                        </p>
                        <div className="mt-2 text-xs text-blue-500 font-mono bg-blue-100 p-2 rounded">
                          migrations/05-add-analytics-snapshots.sql
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
          
          {currentTab === 'settings' && (
            <div className="bg-white rounded-lg shadow-lg p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">
                ⚙️ System Settings
              </h2>
              <div className="space-y-6">
                
                {/* Enhanced System Status */}
                <div className="border-l-4 border-blue-500 pl-4">
                  <h3 className="font-medium text-gray-900 mb-2">
                    🧠 Enhanced Matchup System
                  </h3>
                  <div className="text-sm text-gray-600 space-y-1">
                    <div>✅ Status: Active (30% enhanced, 70% legacy)</div>
                    <div>⏱️ Timeout: 1 second</div>
                    <div>🎯 Unrevealed filtering: Enabled</div>
                    <div>🚀 HTTPS conversion: Complete</div>
                  </div>
                </div>

                {/* Performance Metrics */}
                <div className="border-l-4 border-green-500 pl-4">
                  <h3 className="font-medium text-gray-900 mb-2">
                    📈 Performance Metrics
                  </h3>
                  <div className="text-sm text-gray-600 space-y-1">
                    <div>⚡ Session preload: ~3 seconds</div>
                    <div>🔄 Vote transitions: Instant</div>
                    <div>🧠 Enhanced success rate: Monitoring in console</div>
                    <div>🎮 User experience: Optimized</div>
                  </div>
                </div>

                {/* Quick Actions */}
                <div className="border-l-4 border-yellow-500 pl-4">
                  <h3 className="font-medium text-gray-900 mb-2">
                    🛠️ Quick Actions
                  </h3>
                  <div className="space-y-3">
                    <div className="text-sm text-gray-600">
                      Use browser console to monitor enhanced system:
                    </div>
                    <div className="bg-gray-100 p-2 rounded text-xs font-mono">
                      🧠 Smart enhanced generation...<br/>
                      ⚡ Enhanced same_coll (Score: 0.95) - 85% success<br/>
                      🚀 Using legacy for speed (70% legacy)
                    </div>
                    
                    {/* Cache Management */}
                    <div className="pt-2 border-t border-gray-200">
                      <div className="text-sm text-gray-600 mb-2">Cache Management:</div>
                      <button
                        onClick={async () => {
                          try {
                            const response = await fetch('/api/clear-preloader-cache', { method: 'POST' });
                            const result = await response.json();
                            if (result.success) {
                              alert('✅ Preloader cache cleared! Fresh sessions will be generated with updated filtering.');
                            } else {
                              alert('❌ Failed to clear cache: ' + result.error);
                            }
                          } catch (error) {
                            alert('❌ Error: ' + error);
                          }
                        }}
                        className="px-3 py-1 bg-orange-100 text-orange-700 rounded text-sm hover:bg-orange-200 transition-colors"
                      >
                        🧹 Clear Preloader Cache
                      </button>
                      <div className="text-xs text-gray-500 mt-1">
                        Use if seeing unrevealed NFTs (clears cached sessions)
                      </div>
                    </div>
                  </div>
                </div>

                {/* Access Information */}
                <div className="border-l-4 border-purple-500 pl-4">
                  <h3 className="font-medium text-gray-900 mb-2">
                    🔗 Access Information
                  </h3>
                  <div className="text-sm text-gray-600 space-y-1">
                    <div>📍 Admin URL: <code className="bg-gray-100 px-1 rounded">/admin</code></div>
                    <div>🎮 Main App: <code className="bg-gray-100 px-1 rounded">/</code></div>
                    <div>🔧 API Docs: Collection management via RESTful endpoints</div>
                  </div>
                </div>

              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="text-center text-gray-500 text-sm">
          <p>
            🎨 Taste Machine Admin Panel - Powered by Enhanced Matchup Intelligence
          </p>
        </div>

      </div>
    </div>
  );
}
