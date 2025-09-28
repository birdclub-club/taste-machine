'use client';

import React, { useState, useEffect } from 'react';

interface CAICollection {
  collection_name: string;
  cai_score: number;
  cai_confidence: number;
  cai_cohesion: number;
  cai_coverage: number;
  nft_count: number;
  total_votes: number;
  cai_updated_at: string;
}

interface CAIComponents {
  aesthetic_mean: number;
  trimmed_mean: number;
  cohesion_penalty: number;
  effective_mean: number;
  coverage_score: number;
  confidence: number;
  scored_nft_count: number;
  is_provisional: boolean;
}

interface CAIDetailedResult {
  collection_name: string;
  cai_score: number;
  cai_confidence: number;
  cai_components: CAIComponents;
  cai_explanation: string;
}

export default function CAIAdminPanel() {
  const [leaderboard, setLeaderboard] = useState<CAICollection[]>([]);
  const [candidates, setCandidates] = useState<string[]>([]);
  const [selectedCollection, setSelectedCollection] = useState<string>('');
  const [detailedResult, setDetailedResult] = useState<CAIDetailedResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load initial data
  useEffect(() => {
    loadLeaderboard();
    loadCandidates();
  }, []);

  const loadLeaderboard = async () => {
    try {
      const response = await fetch('/api/compute-cai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'get_leaderboard', limit: 10 }),
      });
      
      const result = await response.json();
      if (result.success) {
        setLeaderboard(result.data.leaderboard || []);
      }
    } catch (error) {
      console.error('Failed to load CAI leaderboard:', error);
    }
  };

  const loadCandidates = async () => {
    try {
      const response = await fetch('/api/compute-cai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'get_candidates' }),
      });
      
      const result = await response.json();
      if (result.success) {
        setCandidates(result.data.candidates || []);
      }
    } catch (error) {
      console.error('Failed to load CAI candidates:', error);
    }
  };

  const computeCAI = async (collectionName: string) => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/compute-cai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          action: 'compute_single', 
          collection_name: collectionName 
        }),
      });
      
      const result = await response.json();
      
      if (result.success) {
        setDetailedResult(result.data.computation);
        await loadLeaderboard(); // Refresh leaderboard
        await loadCandidates(); // Refresh candidates
      } else {
        setError(result.error || 'Computation failed');
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const computeAllCAI = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Get all collection names from leaderboard
      const allCollections = ['BEARISH', 'BEEISH', 'Kabu', 'Canna Sapiens', 'Pengztracted', 'Final Bosu'];
      
      const response = await fetch('/api/compute-cai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          action: 'compute_batch', 
          collection_names: allCollections,
          limit: 2
        }),
      });
      
      const result = await response.json();
      
      if (result.success) {
        await loadLeaderboard(); // Refresh leaderboard
        await loadCandidates(); // Refresh candidates
        setError(null);
      } else {
        setError(result.error || 'Batch computation failed');
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const getQualityLevel = (score: number) => {
    if (score >= 60) return { level: 'Exceptional', color: '#10b981' };
    if (score >= 50) return { level: 'Above Average', color: '#3b82f6' };
    if (score >= 40) return { level: 'Average', color: '#f59e0b' };
    if (score >= 30) return { level: 'Below Average', color: '#ef4444' };
    return { level: 'Poor', color: '#dc2626' };
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 80) return '#10b981';
    if (confidence >= 70) return '#f59e0b';
    return '#ef4444';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold" style={{ color: 'var(--dynamic-text-color)' }}>
            Collection Aesthetic Index (CAI)
          </h2>
          <p className="text-sm opacity-70" style={{ color: 'var(--dynamic-text-color)' }}>
            Collection-level aesthetic scoring with improved algorithm
          </p>
        </div>
        
        <div className="flex gap-3">
          <button
            onClick={computeAllCAI}
            disabled={loading}
            className="px-4 py-2 rounded text-sm font-medium transition-colors"
            style={{
              backgroundColor: 'var(--dynamic-accent-color)',
              color: 'var(--dynamic-bg-color)',
              opacity: loading ? 0.6 : 1,
            }}
          >
            {loading ? 'Computing...' : 'Recompute All'}
          </button>
          
          <button
            onClick={() => { loadLeaderboard(); loadCandidates(); }}
            className="px-4 py-2 rounded text-sm font-medium border transition-colors"
            style={{
              borderColor: 'var(--dynamic-text-color)',
              color: 'var(--dynamic-text-color)',
            }}
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="p-4 rounded border-l-4 border-red-500 bg-red-50 dark:bg-red-900/20">
          <p className="text-red-700 dark:text-red-300">{error}</p>
        </div>
      )}

      {/* CAI Leaderboard */}
      <div className="border rounded-lg overflow-hidden" style={{ borderColor: 'var(--dynamic-text-color)', opacity: 0.2 }}>
        <div className="px-6 py-4 border-b" style={{ borderColor: 'var(--dynamic-text-color)', opacity: 0.2 }}>
          <h3 className="text-lg font-semibold" style={{ color: 'var(--dynamic-text-color)' }}>
            CAI Leaderboard ({leaderboard.length} Collections)
          </h3>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b" style={{ borderColor: 'var(--dynamic-text-color)', opacity: 0.1 }}>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--dynamic-text-color)', opacity: 0.7 }}>
                  Rank
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--dynamic-text-color)', opacity: 0.7 }}>
                  Collection
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--dynamic-text-color)', opacity: 0.7 }}>
                  CAI Score
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--dynamic-text-color)', opacity: 0.7 }}>
                  Confidence
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--dynamic-text-color)', opacity: 0.7 }}>
                  Cohesion
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--dynamic-text-color)', opacity: 0.7 }}>
                  Coverage
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--dynamic-text-color)', opacity: 0.7 }}>
                  Data
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--dynamic-text-color)', opacity: 0.7 }}>
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {leaderboard.map((collection, index) => {
                const quality = getQualityLevel(collection.cai_score);
                return (
                  <tr 
                    key={collection.collection_name}
                    className="border-b hover:bg-opacity-5 hover:bg-gray-500 transition-colors"
                    style={{ borderColor: 'var(--dynamic-text-color)', opacity: 0.1 }}
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm font-medium" style={{ color: 'var(--dynamic-text-color)' }}>
                        {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}th`}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium" style={{ color: 'var(--dynamic-text-color)' }}>
                        {collection.collection_name}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold" style={{ color: quality.color }}>
                          {collection.cai_score}
                        </span>
                        <span className="text-xs px-2 py-1 rounded" style={{ 
                          backgroundColor: quality.color + '20', 
                          color: quality.color 
                        }}>
                          {quality.level}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span 
                        className="text-sm font-medium"
                        style={{ color: getConfidenceColor(collection.cai_confidence) }}
                      >
                        {collection.cai_confidence}%
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm" style={{ color: 'var(--dynamic-text-color)' }}>
                        {collection.cai_cohesion.toFixed(1)}%
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm" style={{ color: 'var(--dynamic-text-color)' }}>
                        {collection.cai_coverage.toFixed(1)}%
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-xs" style={{ color: 'var(--dynamic-text-color)', opacity: 0.7 }}>
                        {collection.nft_count} NFTs<br />
                        {collection.total_votes} votes
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <button
                        onClick={() => computeCAI(collection.collection_name)}
                        disabled={loading}
                        className="text-xs px-3 py-1 rounded border transition-colors"
                        style={{
                          borderColor: 'var(--dynamic-accent-color)',
                          color: 'var(--dynamic-accent-color)',
                        }}
                      >
                        Recompute
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detailed Result */}
      {detailedResult && (
        <div className="border rounded-lg p-6" style={{ borderColor: 'var(--dynamic-text-color)', opacity: 0.2 }}>
          <h3 className="text-lg font-semibold mb-4" style={{ color: 'var(--dynamic-text-color)' }}>
            Latest Computation: {detailedResult.collection_name}
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
            <div className="text-center p-4 rounded" style={{ backgroundColor: 'var(--dynamic-accent-color)', opacity: 0.1 }}>
              <div className="text-2xl font-bold" style={{ color: 'var(--dynamic-accent-color)' }}>
                {detailedResult.cai_score}
              </div>
              <div className="text-sm" style={{ color: 'var(--dynamic-text-color)', opacity: 0.7 }}>
                CAI Score
              </div>
            </div>
            
            <div className="text-center p-4 rounded" style={{ backgroundColor: 'var(--dynamic-text-color)', opacity: 0.1 }}>
              <div className="text-2xl font-bold" style={{ color: 'var(--dynamic-text-color)' }}>
                {detailedResult.cai_components.trimmed_mean.toFixed(1)}
              </div>
              <div className="text-sm" style={{ color: 'var(--dynamic-text-color)', opacity: 0.7 }}>
                Mean POA
              </div>
            </div>
            
            <div className="text-center p-4 rounded" style={{ backgroundColor: 'var(--dynamic-text-color)', opacity: 0.1 }}>
              <div className="text-2xl font-bold" style={{ color: 'var(--dynamic-text-color)' }}>
                {(detailedResult.cai_components.cohesion_penalty * 100).toFixed(1)}%
              </div>
              <div className="text-sm" style={{ color: 'var(--dynamic-text-color)', opacity: 0.7 }}>
                Cohesion Penalty
              </div>
            </div>
            
            <div className="text-center p-4 rounded" style={{ backgroundColor: 'var(--dynamic-text-color)', opacity: 0.1 }}>
              <div className="text-2xl font-bold" style={{ color: 'var(--dynamic-text-color)' }}>
                {detailedResult.cai_confidence}%
              </div>
              <div className="text-sm" style={{ color: 'var(--dynamic-text-color)', opacity: 0.7 }}>
                Confidence
              </div>
            </div>
          </div>
          
          <div className="p-4 rounded" style={{ backgroundColor: 'var(--dynamic-text-color)', opacity: 0.05 }}>
            <h4 className="font-medium mb-2" style={{ color: 'var(--dynamic-text-color)' }}>
              Explanation:
            </h4>
            <p className="text-sm" style={{ color: 'var(--dynamic-text-color)', opacity: 0.8 }}>
              {detailedResult.cai_explanation}
            </p>
          </div>
          
          {detailedResult.cai_components.is_provisional && (
            <div className="mt-4 p-3 rounded border-l-4 border-yellow-500 bg-yellow-50 dark:bg-yellow-900/20">
              <p className="text-yellow-700 dark:text-yellow-300 text-sm">
                ⚠️ This result is marked as <strong>Provisional</strong> due to low confidence or coverage.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Algorithm Info */}
      <div className="border rounded-lg p-6" style={{ borderColor: 'var(--dynamic-text-color)', opacity: 0.2 }}>
        <h3 className="text-lg font-semibold mb-4" style={{ color: 'var(--dynamic-text-color)' }}>
          Improved CAI Algorithm
        </h3>
        
        <div className="space-y-3 text-sm" style={{ color: 'var(--dynamic-text-color)', opacity: 0.8 }}>
          <div>
            <strong>Formula:</strong> CAI = 0.80 × (Mean POA × (1 - Cohesion Penalty)) + 0.20 × Coverage
          </div>
          <div>
            <strong>Cohesion Penalty:</strong> 0-30% penalty based on standard deviation (higher variance = higher penalty)
          </div>
          <div>
            <strong>Confidence:</strong> Data-driven based on coverage, vote depth, and statistical uncertainty
          </div>
          <div>
            <strong>Robustness:</strong> Uses trimmed statistics (removes top/bottom 5% outliers)
          </div>
          <div>
            <strong>Key Improvement:</strong> Mean aesthetic quality drives rankings, cohesion provides nuanced adjustments
          </div>
        </div>
      </div>
    </div>
  );
}

