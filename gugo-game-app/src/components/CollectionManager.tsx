'use client';

import { useState, useEffect } from 'react';

interface Collection {
  collection_name: string;
  active: boolean;
  priority: number;
  nft_count: number;
  avg_votes_per_nft: number;
  total_votes: number;
  votes_today?: number;
  last_selected: string | null;
  hours_since_selected: number | null;
}

interface CollectionStats {
  overview: {
    total_collections: number;
    active_collections: number;
    total_nfts: number;
    total_votes: number;
    votes_today?: number;
    average_elo: number;
    average_votes_per_nft: number;
  };
  insights: {
    most_active_collection: string | null;
    most_active_votes_per_nft: number | null;
    newest_or_unused_collection: string | null;
    collections_needing_more_data: string[];
  };
  collections: Collection[];
}

export default function CollectionManager() {
  const [collections, setCollections] = useState<Collection[]>([]);
  const [stats, setStats] = useState<CollectionStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showInactive, setShowInactive] = useState(false);

  // Fetch collection data
  const fetchCollections = async () => {
    try {
      setLoading(true);
      setError(null);

      const [collectionsResponse, statsResponse] = await Promise.all([
        fetch('/api/collection-management?action=list'),
        fetch('/api/collection-management?action=stats')
      ]);

      if (!collectionsResponse.ok || !statsResponse.ok) {
        throw new Error('Failed to fetch collection data');
      }

      const collectionsData = await collectionsResponse.json();
      const statsData = await statsResponse.json();

      if (collectionsData.success && statsData.success) {
        setCollections(collectionsData.collections || []);
        setStats(statsData.statistics);
      } else {
        throw new Error(collectionsData.error || statsData.error || 'Unknown error');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      console.error('❌ Error fetching collections:', err);
    } finally {
      setLoading(false);
    }
  };

  // Toggle collection active status
  const toggleActive = async (collectionName: string, currentActive: boolean) => {
    try {
      setUpdating(collectionName);
      setError(null);

      const response = await fetch('/api/collection-management', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'set_active',
          collection_name: collectionName,
          active: !currentActive
        })
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Failed to update collection');
      }

      // Update local state
      setCollections(prevCollections =>
        prevCollections.map(collection =>
          collection.collection_name === collectionName
            ? { ...collection, active: !currentActive }
            : collection
        )
      );

      // Smart visibility: If we're deactivating a collection, automatically show inactive collections
      // so the user can see the change. If we're activating, keep current view.
      if (currentActive && !showInactive) {
        // We just deactivated a collection - show inactive so user can see it
        setShowInactive(true);
      }

      console.log(`✅ ${collectionName} ${!currentActive ? 'activated' : 'deactivated'}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      console.error('❌ Error toggling collection:', err);
    } finally {
      setUpdating(null);
    }
  };

  // Set collection priority
  const setPriority = async (collectionName: string, priority: number) => {
    try {
      setUpdating(collectionName);
      setError(null);

      const response = await fetch('/api/collection-management', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'set_priority',
          collection_name: collectionName,
          priority: priority
        })
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Failed to update priority');
      }

      // Update local state
      setCollections(prevCollections =>
        prevCollections.map(collection =>
          collection.collection_name === collectionName
            ? { ...collection, priority: priority }
            : collection
        )
      );

      console.log(`✅ ${collectionName} priority set to ${priority}x`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      console.error('❌ Error setting priority:', err);
    } finally {
      setUpdating(null);
    }
  };

  // Set all collections active/inactive
  const setAllActive = async (active: boolean) => {
    try {
      setUpdating('ALL');
      setError(null);

      const response = await fetch('/api/collection-management', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'set_all_active',
          active: active
        })
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Failed to update all collections');
      }

      // Update local state
      setCollections(prevCollections =>
        prevCollections.map(collection => ({ ...collection, active }))
      );

      console.log(`✅ All collections ${active ? 'activated' : 'deactivated'}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      console.error('❌ Error setting all collections:', err);
    } finally {
      setUpdating(null);
    }
  };

  // Load data on mount
  useEffect(() => {
    fetchCollections();
  }, []);

  // Filter collections based on show/hide inactive
  const filteredCollections = collections.filter(collection => 
    showInactive || collection.active
  );

  // Sort collections by priority (desc), then by name
  const sortedCollections = [...filteredCollections].sort((a, b) => {
    if (a.priority !== b.priority) {
      return b.priority - a.priority; // Higher priority first
    }
    return a.collection_name.localeCompare(b.collection_name);
  });

  if (loading) {
    return (
      <div className="p-6 bg-white rounded-lg shadow-lg">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-300 rounded mb-4"></div>
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-12 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 bg-white rounded-lg shadow-lg max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          🎛️ Collection Management
        </h2>
        <p className="text-gray-600">
          Activate, deactivate, and prioritize collections for matchups and sliders
        </p>
      </div>

              {/* Stats Overview */}
        {stats && (
          <div className="mb-6 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <div className="bg-green-50 p-4 rounded-lg">
              <div className="text-2xl font-bold text-green-600">
                {stats.overview.active_collections}
              </div>
              <div className="text-sm text-green-700">Active Collections</div>
            </div>
            <div className="bg-blue-50 p-4 rounded-lg">
              <div className="text-2xl font-bold text-blue-600">
                {stats.overview.total_collections}
              </div>
              <div className="text-sm text-blue-700">Total Collections</div>
            </div>
            <div className="bg-purple-50 p-4 rounded-lg">
              <div className="text-2xl font-bold text-purple-600">
                {stats.overview.total_nfts.toLocaleString()}
              </div>
              <div className="text-sm text-purple-700">Total NFTs</div>
            </div>
            <div className="bg-red-50 p-4 rounded-lg">
              <div className="text-2xl font-bold text-red-600">
                {stats.overview.total_votes.toLocaleString()}
              </div>
              <div className="text-sm text-red-700">Total Votes (All Time)</div>
            </div>
            <div className="bg-yellow-50 p-4 rounded-lg">
              <div className="text-2xl font-bold text-yellow-600">
                {stats.overview.votes_today?.toLocaleString() || '0'}
              </div>
              <div className="text-sm text-yellow-700">Votes Today</div>
            </div>
            <div className="bg-orange-50 p-4 rounded-lg">
              <div className="text-2xl font-bold text-orange-600">
                {stats.overview.average_votes_per_nft.toFixed(1)}
              </div>
              <div className="text-sm text-orange-700">Avg Votes/NFT</div>
            </div>
          </div>
        )}

      {/* Error Display */}
      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
          <div className="text-red-800">❌ {error}</div>
        </div>
      )}

      {/* Controls */}
      <div className="mb-6 flex flex-wrap gap-4 items-center">
        <button
          onClick={() => setAllActive(true)}
          disabled={updating === 'ALL'}
          className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {updating === 'ALL' ? '⏳' : '✅'} Activate All
        </button>
        <button
          onClick={() => setAllActive(false)}
          disabled={updating === 'ALL'}
          className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {updating === 'ALL' ? '⏳' : '❌'} Deactivate All
        </button>
        <button
          onClick={fetchCollections}
          disabled={loading}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          🔄 Refresh
        </button>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={showInactive}
            onChange={(e) => setShowInactive(e.target.checked)}
            className="rounded cursor-pointer"
          />
          <span className="text-sm text-gray-600">
            {showInactive ? 'Showing all collections' : 'Showing active only'}
            <span className="text-gray-400 ml-1">
              ({filteredCollections.length} visible)
            </span>
          </span>
        </label>
      </div>

      {/* Collections Table */}
      <div className="overflow-x-auto">
        <table className="w-full table-auto">
          <thead>
            <tr className="bg-gray-50">
              <th className="px-4 py-3 text-left font-medium text-gray-900">Collection</th>
              <th className="px-4 py-3 text-center font-medium text-gray-900">Status</th>
              <th className="px-4 py-3 text-center font-medium text-gray-900">Priority</th>
              <th className="px-4 py-3 text-right font-medium text-gray-900">NFTs</th>
              <th className="px-4 py-3 text-right font-medium text-gray-900">Total Votes</th>
              <th className="px-4 py-3 text-right font-medium text-gray-900">Avg Votes</th>
              <th className="px-4 py-3 text-center font-medium text-gray-900">Last Used</th>
            </tr>
          </thead>
          <tbody>
            {sortedCollections.map((collection) => (
              <tr
                key={collection.collection_name}
                className={`border-t ${
                  collection.active ? 'bg-white' : 'bg-gray-50 opacity-75'
                }`}
              >
                {/* Collection Name */}
                <td className="px-4 py-3">
                  <div className="font-medium text-gray-900">
                    {collection.collection_name}
                  </div>
                  {stats?.insights.collections_needing_more_data.includes(collection.collection_name) && (
                    <div className="text-xs text-blue-600">📊 Needs more data</div>
                  )}
                </td>

                {/* Status Toggle */}
                <td className="px-4 py-3 text-center">
                  <button
                    onClick={() => toggleActive(collection.collection_name, collection.active)}
                    disabled={updating === collection.collection_name}
                    title={`Click to ${collection.active ? 'deactivate' : 'activate'} collection`}
                    className={`px-3 py-1 text-xs font-medium rounded-full transition-all duration-200 transform hover:scale-105 ${
                      collection.active
                        ? 'bg-green-100 text-green-800 hover:bg-green-200 shadow-green-200 hover:shadow-md'
                        : 'bg-red-100 text-red-800 hover:bg-red-200 shadow-red-200 hover:shadow-md'
                    } disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none`}
                  >
                    {updating === collection.collection_name 
                      ? '⏳' 
                      : collection.active 
                        ? '✅ Active' 
                        : '❌ Inactive'
                    }
                  </button>
                </td>

                {/* Priority Controls */}
                <td className="px-4 py-3 text-center">
                  <div className="flex items-center justify-center gap-1">
                    <button
                      onClick={() => setPriority(collection.collection_name, Math.max(0.1, collection.priority - 0.1))}
                      disabled={updating === collection.collection_name || collection.priority <= 0.1}
                      className="w-6 h-6 bg-gray-200 hover:bg-gray-300 rounded text-xs disabled:opacity-50"
                    >
                      −
                    </button>
                    <span className="min-w-12 text-sm font-medium">
                      {collection.priority.toFixed(1)}x
                    </span>
                    <button
                      onClick={() => setPriority(collection.collection_name, Math.min(3.0, collection.priority + 0.1))}
                      disabled={updating === collection.collection_name || collection.priority >= 3.0}
                      className="w-6 h-6 bg-gray-200 hover:bg-gray-300 rounded text-xs disabled:opacity-50"
                    >
                      +
                    </button>
                  </div>
                </td>

                {/* NFT Count */}
                <td className="px-4 py-3 text-right text-sm text-gray-600">
                  {collection.nft_count.toLocaleString()}
                </td>

                {/* Total Votes */}
                <td className="px-4 py-3 text-right text-sm text-gray-600">
                  {collection.total_votes.toLocaleString()}
                </td>

                {/* Average Votes */}
                <td className="px-4 py-3 text-right text-sm text-gray-600">
                  {collection.avg_votes_per_nft.toFixed(1)}
                </td>

                {/* Last Used */}
                <td className="px-4 py-3 text-center text-xs text-gray-500">
                  {collection.hours_since_selected === null 
                    ? 'Never' 
                    : collection.hours_since_selected < 1 
                      ? 'Recently' 
                      : `${Math.round(collection.hours_since_selected)}h ago`
                  }
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {sortedCollections.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          {showInactive ? 'No collections found' : 'No active collections found'}
        </div>
      )}

      {/* Insights */}
      {stats?.insights && (
        <div className="mt-6 p-4 bg-blue-50 rounded-lg">
          <h3 className="font-medium text-blue-900 mb-2">📊 Insights</h3>
          <div className="text-sm text-blue-800 space-y-1">
            {stats.insights.most_active_collection && (
              <div>
                🏆 Most active: <strong>{stats.insights.most_active_collection}</strong> 
                ({stats.insights.most_active_votes_per_nft?.toFixed(1)} votes/NFT)
              </div>
            )}
            {stats.insights.newest_or_unused_collection && (
              <div>
                🆕 Unused/New: <strong>{stats.insights.newest_or_unused_collection}</strong>
              </div>
            )}
            {stats.insights.collections_needing_more_data.length > 0 && (
              <div>
                📊 Need more data: <strong>{stats.insights.collections_needing_more_data.join(', ')}</strong>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
