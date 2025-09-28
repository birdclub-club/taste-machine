'use client';

import { useState, useEffect } from 'react';

interface UserStats {
  totalUsers: number;
  dailyUsers: number;
  activeUsersToday?: number;
  newUsersToday?: number;
  usersThisWeek?: number;
  usersThisMonth?: number;
  date: string;
  error?: string;
}

export default function UserStatsDisplay() {
  const [stats, setStats] = useState<UserStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchUserStats = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch('/api/user-stats');
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch user statistics');
      }
      
      setStats(data);
    } catch (err) {
      console.error('❌ Error fetching user stats:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUserStats();
    
    // Refresh every 5 minutes
    const interval = setInterval(fetchUserStats, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-lg p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4">
          👥 User Statistics
        </h2>
        <div className="animate-pulse">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="h-20 bg-gray-200 rounded"></div>
            <div className="h-20 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow-lg p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4">
          👥 User Statistics
        </h2>
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center">
            <div className="text-red-400 mr-3">⚠️</div>
            <div>
              <h3 className="text-red-800 font-medium">Error Loading Statistics</h3>
              <p className="text-red-600 text-sm mt-1">{error}</p>
            </div>
          </div>
          <button
            onClick={fetchUserStats}
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
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-gray-900">
          👥 User Statistics
        </h2>
        <div className="flex items-center space-x-2">
          <span className="text-sm text-gray-500">
            Updated: {stats?.date}
          </span>
          <button
            onClick={fetchUserStats}
            className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
            title="Refresh statistics"
          >
            🔄
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Users (Lifetime) */}
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-4 border border-blue-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-blue-600 text-sm font-medium">Total Users</p>
              <p className="text-2xl font-bold text-blue-900">
                {stats?.totalUsers?.toLocaleString() || '0'}
              </p>
              <p className="text-blue-500 text-xs">Lifetime</p>
            </div>
            <div className="text-blue-400 text-2xl">👤</div>
          </div>
        </div>

        {/* Daily Users */}
        <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-4 border border-green-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-green-600 text-sm font-medium">Daily Users</p>
              <p className="text-2xl font-bold text-green-900">
                {stats?.dailyUsers?.toLocaleString() || '0'}
              </p>
              <p className="text-green-500 text-xs">Today</p>
            </div>
            <div className="text-green-400 text-2xl">📅</div>
          </div>
        </div>

        {/* Active Users Today */}
        {stats?.activeUsersToday !== undefined && (
          <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg p-4 border border-purple-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-purple-600 text-sm font-medium">Active Users</p>
                <p className="text-2xl font-bold text-purple-900">
                  {stats.activeUsersToday.toLocaleString()}
                </p>
                <p className="text-purple-500 text-xs">Voted Today</p>
              </div>
              <div className="text-purple-400 text-2xl">⚡</div>
            </div>
          </div>
        )}

        {/* New Users Today */}
        {stats?.newUsersToday !== undefined && (
          <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-lg p-4 border border-orange-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-orange-600 text-sm font-medium">New Users</p>
                <p className="text-2xl font-bold text-orange-900">
                  {stats.newUsersToday.toLocaleString()}
                </p>
                <p className="text-orange-500 text-xs">Joined Today</p>
              </div>
              <div className="text-orange-400 text-2xl">✨</div>
            </div>
          </div>
        )}
      </div>

      {/* Additional Weekly/Monthly Stats */}
      {(stats?.usersThisWeek || stats?.usersThisMonth) && (
        <div className="mt-6 pt-4 border-t border-gray-200">
          <h3 className="text-sm font-medium text-gray-700 mb-3">Extended Metrics</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {stats.usersThisWeek && (
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <span className="text-gray-600 text-sm">Users This Week</span>
                <span className="font-semibold text-gray-900">
                  {stats.usersThisWeek.toLocaleString()}
                </span>
              </div>
            )}
            {stats.usersThisMonth && (
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <span className="text-gray-600 text-sm">Users This Month</span>
                <span className="font-semibold text-gray-900">
                  {stats.usersThisMonth.toLocaleString()}
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div className="mt-4 pt-4 border-t border-gray-200">
        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-500">
            Auto-refreshes every 5 minutes
          </span>
          <div className="flex space-x-2">
            <button
              onClick={() => window.open('/api/user-stats', '_blank')}
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

