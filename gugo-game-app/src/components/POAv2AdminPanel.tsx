/**
 * 🔧 POA v2 Admin Panel
 * 
 * Admin-only interface for viewing and managing POA v2 scores
 */

import React, { useState, useEffect } from 'react';

interface POAv2Stats {
  totalNFTs: number;
  nftsWithPOAv2: number;
  avgPOAv2: number;
  avgConfidence: number;
  readyForComputation: number;
  lastUpdated: string;
}

interface NFTWithPOA {
  id: string;
  name: string;
  collection: string;
  elo_mean: number;
  total_votes: number;
  poa_v2: number | null;
  poa_v2_confidence: number | null;
  poa_v2_explanation: string | null;
  poa_v2_updated_at: string | null;
}

interface CollectionStats {
  collection: string;
  total_nfts: number;
  ready_for_computation: number;
  nfts_with_poa_v2: number;
  avg_poa_v2: number;
  poa_v2_coverage: number;
}

export default function POAv2AdminPanel() {
  const [stats, setStats] = useState<POAv2Stats | null>(null);
  const [collections, setCollections] = useState<CollectionStats[]>([]);
  const [topNFTs, setTopNFTs] = useState<NFTWithPOA[]>([]);
  const [recentlyComputed, setRecentlyComputed] = useState<NFTWithPOA[]>([]);
  const [loading, setLoading] = useState(false);
  const [computing, setComputing] = useState(false);
  const [selectedCollection, setSelectedCollection] = useState<string>('');
  const [computationLog, setComputationLog] = useState<string[]>([]);
  const [schedulerStatus, setSchedulerStatus] = useState<any>(null);
  const [showScheduler, setShowScheduler] = useState(false);

  // Load POA v2 data
  const loadPOAv2Data = async () => {
    setLoading(true);
    try {
      // Get system stats
      const statsResponse = await fetch('/api/test-poa-v2-schema');
      const statsData = await statsResponse.json();
      
      if (statsData.success) {
        setStats({
          totalNFTs: statsData.data.systemStatus.total_nfts,
          nftsWithPOAv2: statsData.data.systemStatus.nfts_with_poa_v2,
          avgPOAv2: statsData.data.systemStatus.avg_poa_v2,
          avgConfidence: statsData.data.systemStatus.avg_confidence,
          readyForComputation: 0, // Will be filled by collection stats
          lastUpdated: new Date().toISOString(),
        });
      }

      // Get collection stats
      const collectionResponse = await fetch('/api/compute-poa-v2', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'get_collection_stats' }),
      });
      const collectionData = await collectionResponse.json();
      
      if (collectionData.success) {
        setCollections(collectionData.data.collectionStats);
        setStats(prev => prev ? {
          ...prev,
          readyForComputation: collectionData.data.overallStats.readyForComputation,
        } : null);
      }

      // Get top NFTs with POA v2 scores
      await loadTopNFTs();
      
    } catch (error) {
      console.error('Failed to load POA v2 data:', error);
      addToLog(`❌ Failed to load data: ${error}`);
    } finally {
      setLoading(false);
    }
  };

  // Load top NFTs with POA v2 scores
  const loadTopNFTs = async () => {
    try {
      const response = await fetch('/api/admin/poa-v2-nfts');
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setTopNFTs(data.data.topNFTs || []);
          setRecentlyComputed(data.data.recentlyComputed || []);
        }
      }
    } catch (error) {
      console.error('Failed to load top NFTs:', error);
    }
  };

  // Compute POA v2 for a collection
  const computeCollection = async (collectionName: string, limit: number = 10) => {
    setComputing(true);
    addToLog(`🧮 Starting computation for ${collectionName} (limit: ${limit})...`);
    
    try {
      const response = await fetch('/api/compute-poa-v2', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          action: 'compute_collection', 
          collectionName, 
          limit 
        }),
      });
      
      const data = await response.json();
      
      if (data.success) {
        const summary = data.data.summary;
        addToLog(`✅ Computed ${summary.successful_computations}/${summary.total_processed} NFTs`);
        addToLog(`📊 Avg POA v2: ${summary.avg_poa_v2}, Avg Confidence: ${summary.avg_confidence}%`);
        addToLog(`⏱️ Processing time: ${summary.processing_time_ms}ms`);
        
        // Reload data to show updates
        await loadPOAv2Data();
      } else {
        addToLog(`❌ Computation failed: ${data.details || data.error}`);
      }
    } catch (error) {
      addToLog(`❌ Computation error: ${error}`);
    } finally {
      setComputing(false);
    }
  };

  // Compute single NFT
  const computeSingleNFT = async (nftId: string) => {
    setComputing(true);
    addToLog(`🎯 Computing single NFT: ${nftId}...`);
    
    try {
      const response = await fetch('/api/compute-poa-v2', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          action: 'compute_single', 
          nftId 
        }),
      });
      
      const data = await response.json();
      
      if (data.success && data.data.computed) {
        const result = data.data.computation;
        addToLog(`✅ ${data.data.nft.name}: POA v2 = ${result.poa_v2} (${result.poa_v2_confidence}% confidence)`);
        addToLog(`📊 Components: ${result.poa_v2_explanation}`);
        
        // Reload data to show updates
        await loadPOAv2Data();
      } else {
        addToLog(`❌ Failed to compute NFT: ${data.error || 'Unknown error'}`);
      }
    } catch (error) {
      addToLog(`❌ Computation error: ${error}`);
    } finally {
      setComputing(false);
    }
  };

  const addToLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setComputationLog(prev => [`[${timestamp}] ${message}`, ...prev.slice(0, 19)]);
  };

  // Load scheduler status
  const loadSchedulerStatus = async () => {
    try {
      const response = await fetch('/api/admin/poa-v2-scheduler?action=status');
      const data = await response.json();
      if (data.success) {
        setSchedulerStatus(data.data);
      }
    } catch (error) {
      console.error('Failed to load scheduler status:', error);
    }
  };

  // Run manual batch
  const runManualBatch = async () => {
    setComputing(true);
    addToLog('🕐 Starting manual hourly batch...');
    
    try {
      const response = await fetch('/api/admin/poa-v2-scheduler', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'run_batch' }),
      });
      
      const data = await response.json();
      
      if (data.success) {
        const result = data.data.batchResult;
        if (result.success) {
          addToLog(`✅ Batch complete: ${result.summary.successful_computations}/${result.summary.total_processed} NFTs`);
          addToLog(`📊 Avg POA v2: ${result.summary.avg_poa_v2}, Time: ${result.summary.processing_time_ms}ms`);
        } else {
          addToLog(`❌ Batch failed: ${result.error}`);
        }
        await loadPOAv2Data();
        await loadSchedulerStatus();
      } else {
        addToLog(`❌ Batch request failed: ${data.error}`);
      }
    } catch (error) {
      addToLog(`❌ Batch error: ${error}`);
    } finally {
      setComputing(false);
    }
  };

  // Test trigger for specific NFT
  const testTrigger = async (nftId: string, triggerType: string) => {
    setComputing(true);
    addToLog(`🎯 Testing ${triggerType} trigger for NFT...`);
    
    try {
      const response = await fetch('/api/admin/poa-v2-scheduler', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          action: 'simulate_trigger', 
          nftId, 
          triggerType 
        }),
      });
      
      const data = await response.json();
      
      if (data.success) {
        const result = data.data.simulation;
        if (result.success && result.result) {
          addToLog(`✅ Trigger test: POA v2 = ${result.result.poa_v2} (${result.result.poa_v2_confidence}% confidence)`);
        } else {
          addToLog(`⏭️ Trigger test: ${result.error || 'No computation needed'}`);
        }
        await loadPOAv2Data();
      } else {
        addToLog(`❌ Trigger test failed: ${data.error}`);
      }
    } catch (error) {
      addToLog(`❌ Trigger test error: ${error}`);
    } finally {
      setComputing(false);
    }
  };

  useEffect(() => {
    loadPOAv2Data();
    loadSchedulerStatus();
  }, []);

  if (loading) {
    return (
      <div className="p-6 bg-white rounded-lg shadow-lg">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="space-y-3">
            <div className="h-3 bg-gray-200 rounded"></div>
            <div className="h-3 bg-gray-200 rounded w-5/6"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white p-6 rounded-lg">
        <h2 className="text-2xl font-bold mb-2">🧮 POA v2 Admin Panel</h2>
        <p className="opacity-90">Manage and monitor Proof of Aesthetic v2 scoring system</p>
      </div>

      {/* System Stats */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="bg-white p-4 rounded-lg shadow border-l-4 border-blue-500">
            <div className="text-2xl font-bold text-blue-600">{stats.totalNFTs.toLocaleString()}</div>
            <div className="text-sm text-gray-600">Total NFTs</div>
          </div>
          <div className="bg-white p-4 rounded-lg shadow border-l-4 border-green-500">
            <div className="text-2xl font-bold text-green-600">{stats.nftsWithPOAv2}</div>
            <div className="text-sm text-gray-600">With POA v2</div>
          </div>
          <div className="bg-white p-4 rounded-lg shadow border-l-4 border-purple-500">
            <div className="text-2xl font-bold text-purple-600">{stats.readyForComputation}</div>
            <div className="text-sm text-gray-600">Ready to Compute</div>
          </div>
          <div className="bg-white p-4 rounded-lg shadow border-l-4 border-orange-500">
            <div className="text-2xl font-bold text-orange-600">{stats.avgPOAv2?.toFixed(1) || 'N/A'}</div>
            <div className="text-sm text-gray-600">Avg POA v2</div>
          </div>
          <div className="bg-white p-4 rounded-lg shadow border-l-4 border-red-500">
            <div className="text-2xl font-bold text-red-600">{stats.avgConfidence?.toFixed(1) || 'N/A'}%</div>
            <div className="text-sm text-gray-600">Avg Confidence</div>
          </div>
        </div>
      )}

      {/* Collections Overview */}
      <div className="bg-white rounded-lg shadow-lg p-6">
        <h3 className="text-xl font-bold mb-4">📚 Collections Overview</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Collection</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total NFTs</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ready</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">With POA v2</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Coverage</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {collections.slice(0, 10).map((collection) => (
                <tr key={collection.collection} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {collection.collection}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {collection.total_nfts}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                      {collection.ready_for_computation}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                      {collection.nfts_with_poa_v2}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {collection.poa_v2_coverage.toFixed(1)}%
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <button
                      onClick={() => computeCollection(collection.collection, 5)}
                      disabled={computing || collection.ready_for_computation === 0}
                      className="inline-flex items-center px-3 py-1 border border-transparent text-xs font-medium rounded text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Compute 5
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Scheduler Controls */}
      <div className="bg-white rounded-lg shadow-lg p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-bold">🕐 Trigger + Batch Scheduler</h3>
          <button
            onClick={() => setShowScheduler(!showScheduler)}
            className="px-3 py-1 bg-blue-100 text-blue-700 rounded-md hover:bg-blue-200 text-sm"
          >
            {showScheduler ? 'Hide' : 'Show'} Scheduler
          </button>
        </div>

        {showScheduler && schedulerStatus && (
          <div className="space-y-4 mb-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                <h4 className="font-semibold text-green-900 mb-2">🎯 Trigger Strategy</h4>
                <div className="text-sm text-green-800 space-y-1">
                  <div>✅ Super votes: Always compute</div>
                  <div>✅ FIRE votes: Always compute</div>
                  <div>✅ Milestones: 5, 10, 25, 50, 100 votes</div>
                  <div>✅ High activity: 5+ votes in 24h</div>
                </div>
              </div>
              
              <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                <h4 className="font-semibold text-blue-900 mb-2">🕐 Batch Schedule</h4>
                <div className="text-sm text-blue-800 space-y-1">
                  <div>⏰ Frequency: Every hour</div>
                  <div>📦 Batch size: 20 NFTs max</div>
                  <div>⏱️ Delay: 500ms between NFTs</div>
                  <div>🎯 Priority: New NFTs + old scores</div>
                </div>
              </div>
              
              <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
                <h4 className="font-semibold text-purple-900 mb-2">📊 Recent Activity</h4>
                <div className="text-sm text-purple-800 space-y-1">
                  <div>📈 Last 24h: {schedulerStatus.recentActivity?.computationsLast24h || 0} computations</div>
                  <div>🎯 High priority: {schedulerStatus.triggerCandidates?.highPriority || 0} NFTs</div>
                  <div>⏰ Next batch: {new Date(schedulerStatus.nextBatch?.estimatedTime || Date.now()).toLocaleTimeString()}</div>
                </div>
              </div>
            </div>

            <div className="flex space-x-4">
              <button
                onClick={runManualBatch}
                disabled={computing}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
              >
                {computing ? 'Running...' : '🕐 Run Batch Now'}
              </button>
              
              <button
                onClick={() => testTrigger('fad3a24b-da95-4256-b7ec-f2f52fbd0ab8', 'milestone')}
                disabled={computing}
                className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
              >
                {computing ? 'Testing...' : '🎯 Test Trigger'}
              </button>
              
              <button
                onClick={loadSchedulerStatus}
                className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 text-sm"
              >
                🔄 Refresh Status
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Manual Computation Controls */}
      <div className="bg-white rounded-lg shadow-lg p-6">
        <h3 className="text-xl font-bold mb-4">⚡ Manual Computation</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          {/* Collection Computation */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Compute by Collection
            </label>
            <div className="flex space-x-2">
              <select
                value={selectedCollection}
                onChange={(e) => setSelectedCollection(e.target.value)}
                className="flex-1 border border-gray-300 rounded-md px-3 py-2 text-sm"
              >
                <option value="">Select Collection</option>
                {collections.filter(c => c.ready_for_computation > 0).map(c => (
                  <option key={c.collection} value={c.collection}>
                    {c.collection} ({c.ready_for_computation} ready)
                  </option>
                ))}
              </select>
              <button
                onClick={() => selectedCollection && computeCollection(selectedCollection, 10)}
                disabled={computing || !selectedCollection}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
              >
                {computing ? 'Computing...' : 'Compute 10'}
              </button>
            </div>
          </div>

          {/* Refresh Data */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              System Actions
            </label>
            <div className="flex space-x-2">
              <button
                onClick={loadPOAv2Data}
                disabled={loading}
                className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 disabled:opacity-50 text-sm"
              >
                {loading ? 'Loading...' : 'Refresh Data'}
              </button>
              <button
                onClick={() => setComputationLog([])}
                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 text-sm"
              >
                Clear Log
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Computation Log */}
      <div className="bg-white rounded-lg shadow-lg p-6">
        <h3 className="text-xl font-bold mb-4">📋 Computation Log</h3>
        <div className="bg-gray-900 text-green-400 p-4 rounded-lg font-mono text-sm max-h-64 overflow-y-auto">
          {computationLog.length === 0 ? (
            <div className="text-gray-500">No computation activity yet...</div>
          ) : (
            computationLog.map((log, index) => (
              <div key={index} className="mb-1">{log}</div>
            ))
          )}
        </div>
      </div>

      {/* POA v2 Explanation */}
      <div className="bg-white rounded-lg shadow-lg p-6">
        <h3 className="text-xl font-bold mb-4">🧮 POA v2 Calculation Method</h3>
        <div className="space-y-4 text-sm">
          <div className="bg-blue-50 p-4 rounded-lg">
            <h4 className="font-semibold text-blue-900 mb-2">Multi-Component Scoring (0-100 scale)</h4>
            <ul className="space-y-1 text-blue-800">
              <li><strong>Elo Component (40%):</strong> Head-to-head matchup performance</li>
              <li><strong>Slider Component (30%):</strong> Per-user normalized aesthetic ratings</li>
              <li><strong>FIRE Component (30%):</strong> Community FIRE votes with diminishing returns</li>
            </ul>
          </div>
          
          <div className="bg-green-50 p-4 rounded-lg">
            <h4 className="font-semibold text-green-900 mb-2">Computation Strategy</h4>
            <ul className="space-y-1 text-green-800">
              <li><strong>Trigger-based:</strong> Immediate computation for super votes, FIRE votes, and milestones</li>
              <li><strong>Hourly Batches:</strong> Scheduled processing for new NFTs and score updates</li>
              <li><strong>Database Efficient:</strong> Conservative batch sizes with delays to prevent overload</li>
              <li><strong>Priority System:</strong> High-activity NFTs get immediate attention</li>
            </ul>
          </div>
          
          <div className="bg-yellow-50 p-4 rounded-lg">
            <h4 className="font-semibold text-yellow-900 mb-2">Confidence Scoring</h4>
            <p className="text-yellow-800">
              Based on Elo uncertainty (sigma) and vote depth. Higher confidence = more reliable score.
              Confidence above 60% indicates a well-established aesthetic rating.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
