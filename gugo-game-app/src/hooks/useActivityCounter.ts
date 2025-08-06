import { useState, useEffect } from 'react';

const BOOST_MULTIPLIER = 10;
const SIMULATION_INTERVAL = 1500; // 1.5 seconds
const MIN_INCREMENT = 0;
const MAX_INCREMENT = 2;

interface ActivityCounterData {
  count: number;
  date: string;
  error?: string;
}

export function useActivityCounter() {
  const [licksToday, setLicksToday] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch initial daily vote count
  useEffect(() => {
    const fetchDailyCount = async () => {
      try {
        setIsLoading(true);
        const response = await fetch('/api/daily-vote-count');
        const data: ActivityCounterData = await response.json();
        
        if (data.error) {
          setError(data.error);
          setLicksToday(480); // Fallback to a reasonable number (48 * 10)
        } else {
          const boostedCount = data.count * BOOST_MULTIPLIER;
          setLicksToday(boostedCount);
          console.log(`📊 Daily votes: ${data.count} → Boosted: ${boostedCount}`);
        }
      } catch (err) {
        console.error('❌ Failed to fetch daily vote count:', err);
        setError('Failed to load activity data');
        setLicksToday(480); // Fallback
      } finally {
        setIsLoading(false);
      }
    };

    fetchDailyCount();
  }, []);

  // Simulate real-time growth
  useEffect(() => {
    if (isLoading) return;

    const interval = setInterval(() => {
      setLicksToday(prev => {
        const increment = Math.floor(Math.random() * (MAX_INCREMENT - MIN_INCREMENT + 1)) + MIN_INCREMENT;
        return prev + increment;
      });
    }, SIMULATION_INTERVAL);

    return () => clearInterval(interval);
  }, [isLoading]);

  return {
    licksToday: Math.floor(licksToday),
    isLoading,
    error
  };
}