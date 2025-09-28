'use client';

import { useState, useEffect } from 'react';

interface AnalyticsData {
  id: string;
  date: string;
  created_at: string;
  total_users: number;
  daily_users: number;
  active_users: number;
  new_users: number;
  total_votes?: number;
  daily_votes: number;
  total_collections: number;
  active_collections: number;
  total_nfts: number;
  avg_votes_per_nft?: number;
  collection_engagement?: number;
  new_collections?: number;
  collections_with_votes?: number;
  displayDate?: string;
  fullDate?: string;
}

interface AnalyticsResponse {
  success: boolean;
  history: AnalyticsData[];
  note?: string;
  error?: string;
}

export default function AnalyticsChartsSimple() {
  const [data, setData] = useState<AnalyticsData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedMetric, setSelectedMetric] = useState<'users' | 'votes' | 'collections' | 'growth'>('users');

  const fetchAnalyticsHistory = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch('/api/analytics-history');
      const result: AnalyticsResponse = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || 'Failed to fetch analytics history');
      }
      
      setData(result.history || []);
    } catch (err) {
      console.error('❌ Error fetching analytics history:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalyticsHistory();
    
    // Refresh every 10 minutes
    const interval = setInterval(fetchAnalyticsHistory, 10 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-lg p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4">
          📈 Analytics Over Time
        </h2>
        <div className="animate-pulse">
          <div className="h-80 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow-lg p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4">
          📈 Analytics Over Time
        </h2>
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center">
            <div className="text-red-400 mr-3">⚠️</div>
            <div>
              <h3 className="text-red-800 font-medium">Error Loading Charts</h3>
              <p className="text-red-600 text-sm mt-1">{error}</p>
            </div>
          </div>
          <button
            onClick={fetchAnalyticsHistory}
            className="mt-3 px-4 py-2 bg-red-100 text-red-700 rounded hover:bg-red-200 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // Simple table-based visualization instead of charts to avoid Recharts issues
  const renderSimpleChart = () => {
    if (!data || data.length === 0) {
      return (
        <div className="flex items-center justify-center h-80 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
          <div className="text-center">
            <div className="text-gray-400 text-4xl mb-2">📊</div>
            <div className="text-gray-500 font-medium">No Data Available</div>
            <div className="text-gray-400 text-sm">Historical data will appear here</div>
          </div>
        </div>
      );
    }

    // Show last 7 days for simplicity
    const recentData = data.slice(-7);

    return (
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Date
              </th>
              {selectedMetric === 'users' && (
                <>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Total Users
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Daily Active
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    New Users
                  </th>
                </>
              )}
              {selectedMetric === 'votes' && (
                <>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Daily Votes
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Total Votes
                  </th>
                </>
              )}
              {selectedMetric === 'collections' && (
                <>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Active Collections
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Total Collections
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Collections w/ Votes
                  </th>
                </>
              )}
              {selectedMetric === 'growth' && (
                <>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Total NFTs
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Avg Votes/NFT
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Engagement %
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    New Collections
                  </th>
                </>
              )}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {recentData.map((item, index) => (
              <tr key={item.id} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                  {new Date(item.date).toLocaleDateString()}
                </td>
                {selectedMetric === 'users' && (
                  <>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        {item.total_users.toLocaleString()}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        {item.daily_users.toLocaleString()}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                        {item.new_users.toLocaleString()}
                      </span>
                    </td>
                  </>
                )}
                {selectedMetric === 'votes' && (
                  <>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        {item.daily_votes.toLocaleString()}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        {item.total_votes?.toLocaleString() || 'N/A'}
                      </span>
                    </td>
                  </>
                )}
                {selectedMetric === 'collections' && (
                  <>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                        {item.active_collections.toLocaleString()}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                        {item.total_collections.toLocaleString()}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800">
                        {item.collections_with_votes?.toLocaleString() || 'N/A'}
                      </span>
                    </td>
                  </>
                )}
                {selectedMetric === 'growth' && (
                  <>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        {item.total_nfts.toLocaleString()}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        {item.avg_votes_per_nft?.toFixed(2) || 'N/A'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                        {item.collection_engagement ? `${(item.collection_engagement * 100).toFixed(1)}%` : 'N/A'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-pink-100 text-pink-800">
                        {item.new_collections?.toLocaleString() || '0'}
                      </span>
                    </td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-gray-900">
          📈 Analytics Over Time
        </h2>
        <div className="flex items-center space-x-2">
          <span className="text-sm text-gray-500">Last 7 days</span>
          <button
            onClick={fetchAnalyticsHistory}
            className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
            title="Refresh data"
          >
            🔄
          </button>
        </div>
      </div>

      {/* Metric Selector */}
      <div className="flex space-x-2 mb-6">
        <button
          onClick={() => setSelectedMetric('users')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            selectedMetric === 'users'
              ? 'bg-blue-100 text-blue-700 border border-blue-200'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          👥 Users
        </button>
        <button
          onClick={() => setSelectedMetric('votes')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            selectedMetric === 'votes'
              ? 'bg-green-100 text-green-700 border border-green-200'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          🗳️ Votes
        </button>
        <button
          onClick={() => setSelectedMetric('collections')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            selectedMetric === 'collections'
              ? 'bg-purple-100 text-purple-700 border border-purple-200'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          📊 Collections
        </button>
        <button
          onClick={() => setSelectedMetric('growth')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            selectedMetric === 'growth'
              ? 'bg-pink-100 text-pink-700 border border-pink-200'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          📈 Growth
        </button>
      </div>

      {/* Simple Table Chart */}
      <div className="mb-6">
        {renderSimpleChart()}
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t border-gray-200">
        <div className="text-center">
          <div className="text-2xl font-bold text-blue-600">
            {data && data.length > 0 ? (data[data.length - 1]?.total_users?.toLocaleString() || '0') : '0'}
          </div>
          <div className="text-xs text-gray-500">Current Users</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-green-600">
            {data && data.length > 0 ? (data[data.length - 1]?.daily_votes?.toLocaleString() || '0') : '0'}
          </div>
          <div className="text-xs text-gray-500">Votes Today</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-purple-600">
            {data && data.length > 0 ? (data[data.length - 1]?.active_collections || '0') : '0'}
          </div>
          <div className="text-xs text-gray-500">Active Collections</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-pink-600">
            {data && data.length > 0 ? (data[data.length - 1]?.total_nfts?.toLocaleString() || '0') : '0'}
          </div>
          <div className="text-xs text-gray-500">Total NFTs</div>
        </div>
      </div>

      {/* Growth Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 mt-4 border-t border-gray-100">
        <div className="text-center">
          <div className="text-lg font-semibold text-orange-600">
            {data && data.length > 0 ? data.reduce((sum, d) => sum + (d.new_users || 0), 0).toLocaleString() : '0'}
          </div>
          <div className="text-xs text-gray-500">New Users (7d)</div>
        </div>
        <div className="text-center">
          <div className="text-lg font-semibold text-indigo-600">
            {data && data.length > 0 ? data.reduce((sum, d) => sum + (d.new_collections || 0), 0).toLocaleString() : '0'}
          </div>
          <div className="text-xs text-gray-500">New Collections (7d)</div>
        </div>
        <div className="text-center">
          <div className="text-lg font-semibold text-teal-600">
            {data && data.length > 0 ? (data[data.length - 1]?.avg_votes_per_nft?.toFixed(2) || '0') : '0'}
          </div>
          <div className="text-xs text-gray-500">Avg Votes/NFT</div>
        </div>
        <div className="text-center">
          <div className="text-lg font-semibold text-yellow-600">
            {data && data.length > 0 ? 
              (data[data.length - 1]?.collection_engagement ? 
                `${(data[data.length - 1].collection_engagement! * 100).toFixed(1)}%` : '0%') : '0%'}
          </div>
          <div className="text-xs text-gray-500">Collection Engagement</div>
        </div>
      </div>

      {/* Data Source Note */}
      <div className="mt-4 pt-4 border-t border-gray-200">
        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-500">
            📊 {data.length} data points • Auto-refreshes every 10 minutes
          </span>
          <div className="flex space-x-2">
            <button
              onClick={() => window.open('/api/analytics-history', '_blank')}
              className="text-xs text-blue-600 hover:text-blue-800 transition-colors"
            >
              View Raw Data
            </button>
          </div>
        </div>
      </div>

      {/* Note about charts */}
      <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg p-3">
        <div className="flex items-start">
          <div className="text-blue-400 mr-2">💡</div>
          <div className="text-sm">
            <span className="text-blue-800 font-medium">Table View:</span>
            <span className="text-blue-600 ml-1">
              Showing data in table format for reliability. Charts can be enabled after fixing Recharts compatibility.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
