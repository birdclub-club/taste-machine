'use client';

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { format, parseISO } from 'date-fns';

// Dynamically import Recharts components to avoid SSR issues
const LineChart = dynamic(() => import('recharts').then((mod) => mod.LineChart), { ssr: false });
const Line = dynamic(() => import('recharts').then((mod) => mod.Line), { ssr: false });
const XAxis = dynamic(() => import('recharts').then((mod) => mod.XAxis), { ssr: false });
const YAxis = dynamic(() => import('recharts').then((mod) => mod.YAxis), { ssr: false });
const CartesianGrid = dynamic(() => import('recharts').then((mod) => mod.CartesianGrid), { ssr: false });
const Tooltip = dynamic(() => import('recharts').then((mod) => mod.Tooltip), { ssr: false });
// Legend component removed due to TypeScript compatibility issues
const ResponsiveContainer = dynamic(() => import('recharts').then((mod) => mod.ResponsiveContainer), { ssr: false });
const AreaChart = dynamic(() => import('recharts').then((mod) => mod.AreaChart), { ssr: false });
const Area = dynamic(() => import('recharts').then((mod) => mod.Area), { ssr: false });
const BarChart = dynamic(() => import('recharts').then((mod) => mod.BarChart), { ssr: false });
const Bar = dynamic(() => import('recharts').then((mod) => mod.Bar), { ssr: false });

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
}

interface AnalyticsResponse {
  success: boolean;
  history: AnalyticsData[];
  note?: string;
  error?: string;
}

export default function AnalyticsCharts() {
  const [data, setData] = useState<AnalyticsData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedMetric, setSelectedMetric] = useState<'users' | 'votes' | 'collections'>('users');
  const [mounted, setMounted] = useState(false);

  const fetchAnalyticsHistory = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch('/api/analytics-history');
      const result: AnalyticsResponse = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || 'Failed to fetch analytics history');
      }
      
      // Format dates for display
      const formattedData = result.history.map(item => ({
        ...item,
        displayDate: format(parseISO(item.date), 'MMM dd'),
        fullDate: format(parseISO(item.date), 'MMMM dd, yyyy')
      }));
      
      setData(formattedData);
    } catch (err) {
      console.error('❌ Error fetching analytics history:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setMounted(true);
    fetchAnalyticsHistory();
    
    // Refresh every 10 minutes
    const interval = setInterval(fetchAnalyticsHistory, 10 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-white p-4 border border-gray-200 rounded-lg shadow-lg">
          <p className="font-medium text-gray-900">{data.fullDate}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} className="text-sm" style={{ color: entry.color }}>
              {entry.name}: <span className="font-semibold">{entry.value.toLocaleString()}</span>
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  // Don't render until mounted to avoid SSR issues
  if (!mounted) {
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

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-gray-900">
          📈 Analytics Over Time
        </h2>
        <div className="flex items-center space-x-2">
          <span className="text-sm text-gray-500">Last 30 days</span>
          <button
            onClick={fetchAnalyticsHistory}
            className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
            title="Refresh charts"
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
      </div>

      {/* Charts */}
      <div className="h-80 mb-6">
        {data && data.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            {selectedMetric === 'users' ? (
              <AreaChart data={data}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis 
                  dataKey="displayDate" 
                  stroke="#666"
                  fontSize={12}
                  tick={{ fill: '#666' }}
                />
                <YAxis 
                  stroke="#666"
                  fontSize={12}
                  tick={{ fill: '#666' }}
                />
                <Tooltip content={<CustomTooltip />} />

                <Area
                  type="monotone"
                  dataKey="total_users"
                  stackId="1"
                  stroke="#3b82f6"
                  fill="#3b82f6"
                  fillOpacity={0.6}
                  name="Total Users"
                />
                <Area
                  type="monotone"
                  dataKey="daily_users"
                  stackId="2"
                  stroke="#10b981"
                  fill="#10b981"
                  fillOpacity={0.6}
                  name="Daily Active"
                />
                <Area
                  type="monotone"
                  dataKey="new_users"
                  stackId="3"
                  stroke="#f59e0b"
                  fill="#f59e0b"
                  fillOpacity={0.6}
                  name="New Users"
                />
              </AreaChart>
            ) : selectedMetric === 'votes' ? (
              <LineChart data={data}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis 
                  dataKey="displayDate" 
                  stroke="#666"
                  fontSize={12}
                  tick={{ fill: '#666' }}
                />
                <YAxis 
                  stroke="#666"
                  fontSize={12}
                  tick={{ fill: '#666' }}
                />
                <Tooltip content={<CustomTooltip />} />

                <Line
                  type="monotone"
                  dataKey="daily_votes"
                  stroke="#10b981"
                  strokeWidth={3}
                  dot={{ fill: '#10b981', strokeWidth: 2, r: 4 }}
                  name="Daily Votes"
                />
                {data.some(d => d.total_votes) && (
                  <Line
                    type="monotone"
                    dataKey="total_votes"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    dot={{ fill: '#3b82f6', strokeWidth: 2, r: 3 }}
                    name="Total Votes"
                  />
                )}
              </LineChart>
            ) : selectedMetric === 'collections' ? (
              <BarChart data={data}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis 
                  dataKey="displayDate" 
                  stroke="#666"
                  fontSize={12}
                  tick={{ fill: '#666' }}
                />
                <YAxis 
                  stroke="#666"
                  fontSize={12}
                  tick={{ fill: '#666' }}
                />
                <Tooltip content={<CustomTooltip />} />

                <Bar
                  dataKey="active_collections"
                  fill="#8b5cf6"
                  name="Active Collections"
                  radius={[2, 2, 0, 0]}
                />
                <Bar
                  dataKey="total_collections"
                  fill="#e5e7eb"
                  name="Total Collections"
                  radius={[2, 2, 0, 0]}
                />
              </BarChart>
            ) : (
              <AreaChart data={data}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis 
                  dataKey="displayDate" 
                  stroke="#666"
                  fontSize={12}
                  tick={{ fill: '#666' }}
                />
                <YAxis 
                  stroke="#666"
                  fontSize={12}
                  tick={{ fill: '#666' }}
                />
                <Tooltip content={<CustomTooltip />} />

                <Area 
                  type="monotone" 
                  dataKey="growthRate" 
                  stroke="#06b6d4" 
                  fill="#06b6d4" 
                  fillOpacity={0.6}
                  name="Growth Rate %"
                />
              </AreaChart>
            )}
          </ResponsiveContainer>
        ) : (
          <div className="flex items-center justify-center h-full bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
            <div className="text-center">
              <div className="text-gray-400 text-4xl mb-2">📊</div>
              <div className="text-gray-500 font-medium">No Data Available</div>
              <div className="text-gray-400 text-sm">Charts will appear when data is loaded</div>
            </div>
          </div>
        )}
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
          <div className="text-2xl font-bold text-orange-600">
            {data && data.length > 0 ? data.reduce((sum, d) => sum + (d.new_users || 0), 0).toLocaleString() : '0'}
          </div>
          <div className="text-xs text-gray-500">Total New Users (30d)</div>
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
    </div>
  );
}
