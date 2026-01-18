import { useState, useEffect, useMemo } from 'react';
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  Timestamp,
  Firestore
} from 'firebase/firestore';
// @ts-ignore - firebaseConfig is a JS file
import { db, ensureAuthenticated } from '../utils/firebaseConfig';
import { StravaActivity, VizData, ChartFilters, FitnessStats } from '../types/strava';


/**
 * Calculate linear regression for trend line
 */
const calculateLinearRegression = (data: VizData[], field: keyof VizData): { slope: number; intercept: number } => {
  const n = data.length;
  if (n === 0) return { slope: 0, intercept: 0 };

  const sumX = data.reduce((sum, d, i) => sum + i, 0);
  const sumY = data.reduce((sum, d) => sum + (d[field] as number), 0);
  const sumXY = data.reduce((sum, d, i) => sum + i * (d[field] as number), 0);
  const sumX2 = data.reduce((sum, d, i) => sum + i * i, 0);

  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;

  return { slope, intercept };
};

export const useFitnessData = (athleteId: string | null) => {
  const [activities, setActivities] = useState<StravaActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter state
  const [filters, setFilters] = useState<ChartFilters>(() => {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setFullYear(startDate.getFullYear() - 2);

    return {
      dateRange: [startDate, endDate],
      minDistance: 3, // km
      maxDistance: 15, // km
    };
  });

  // Fetch activities with real-time updates
  useEffect(() => {
    // @ts-expect-error - db is from JS file
    if (!athleteId || !(db as any)) {
      setLoading(false);
      return;
    }

    let unsubscribe: (() => void) | undefined;

    const setupListener = async () => {
      try {
        await ensureAuthenticated();

        const twoYearsAgo = new Date();
        twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);

        // @ts-expect-error - db is from JS file
        const activitiesRef = collection(db as any, 'athletes', String(athleteId), 'activities');
        const q = query(
          activitiesRef,
          where('type', '==', 'Run'),
          where('start_date', '>=', twoYearsAgo.toISOString()),
          orderBy('start_date', 'desc')
        );

        unsubscribe = onSnapshot(
          q,
          (snapshot) => {
            const fetchedActivities: StravaActivity[] = [];
            snapshot.forEach((doc) => {
              const data = doc.data();
              fetchedActivities.push({
                id: doc.id,
                ...data,
              } as StravaActivity);
            });

            setActivities(fetchedActivities);
            setLoading(false);
            setError(null);
          },
          (err) => {
            console.error('Error fetching activities:', err);
            setError(err.message);
            setLoading(false);
          }
        );
      } catch (err) {
        console.error('Error setting up listener:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch activities');
        setLoading(false);
      }
    };

    setupListener();

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [athleteId]);

  // Process and filter activities
  const vizData = useMemo((): VizData[] => {
    const filtered = activities
      .filter((activity) => {
        // Filter by distance (3km - 15km)
        const distanceKm = activity.distance / 1000;
        if (distanceKm < filters.minDistance || distanceKm > filters.maxDistance) {
          return false;
        }

        // Must have heart rate data
        if (!activity.average_heartrate || activity.average_heartrate <= 0) {
          return false;
        }

        // Must have valid speed
        if (!activity.average_speed || activity.average_speed <= 0) {
          return false;
        }

        // Date range filter
        const activityDate = new Date(activity.start_date);
        if (activityDate < filters.dateRange[0] || activityDate > filters.dateRange[1]) {
          return false;
        }

        return true;
      })
      .map((activity) => {
        const distanceKm = activity.distance / 1000;
        const gap = activity.gap ? (1000 / (activity.gap * 60)) : (1000 / (activity.average_speed * 60));
        const pace = 1000 / (activity.average_speed * 60);
        const hr = activity.average_heartrate || 0;
        // Efficiency = Speed (km/h) / Heart Rate * 100
        const speedKph = 60 / gap;
        const efficiency = (speedKph / (hr || 1)) * 100;

        return {
          date: new Date(activity.start_date),
          gap,
          hr,
          distanceKm,
          runName: activity.name,
          efficiency,
          elevationGain: activity.total_elevation_gain,
          pace,
          activityId: activity.id,
        } as VizData;
      })
      .filter((d) => d.gap > 0 && d.gap < 20); // Filter out unrealistic GAP values

    // Calculate improvement percentage based on efficiency (higher is better)
    const avgEff = filtered.reduce((sum, d) => sum + d.efficiency, 0) / (filtered.length || 1);
    return filtered.map((d) => ({
      ...d,
      improvementPercent: ((d.efficiency - avgEff) / avgEff) * 100,
    }));
  }, [activities, filters]);

  // Calculate stats
  const stats = useMemo((): FitnessStats => {
    if (vizData.length === 0) {
      return {
        avgGap: 0,
        avgHr: 0,
        avgEfficiency: 0,
        totalRuns: 0,
        totalDistance: 0,
        bestGap: 0,
        worstGap: 0,
        recentTrend: 'stable',
      };
    }

    const avgGap = vizData.reduce((sum, d) => sum + d.gap, 0) / vizData.length;
    const avgHr = vizData.reduce((sum, d) => sum + d.hr, 0) / vizData.length;
    const avgEfficiency = vizData.reduce((sum, d) => sum + d.efficiency, 0) / vizData.length;
    const totalDistance = vizData.reduce((sum, d) => sum + d.distanceKm, 0);
    const bestGap = Math.min(...vizData.map((d) => d.gap));
    const worstGap = Math.max(...vizData.map((d) => d.gap));

    // Calculate trend: compare recent 10 runs vs previous 10
    const sortedByDate = [...vizData].sort((a, b) => b.date.getTime() - a.date.getTime());
    const recent10 = sortedByDate.slice(0, 10);
    const previous10 = sortedByDate.slice(10, 20);

    let recentTrend: 'improving' | 'declining' | 'stable' = 'stable';
    if (recent10.length >= 5 && previous10.length >= 5) {
      const recentAvg = recent10.reduce((sum, d) => sum + d.gap, 0) / recent10.length;
      const previousAvg = previous10.reduce((sum, d) => sum + d.gap, 0) / previous10.length;
      const diff = ((previousAvg - recentAvg) / previousAvg) * 100;

      if (diff > 2) recentTrend = 'improving'; // GAP decreased (faster)
      else if (diff < -2) recentTrend = 'declining'; // GAP increased (slower)
    }

    return {
      avgGap,
      avgHr,
      avgEfficiency,
      totalRuns: vizData.length,
      totalDistance,
      bestGap,
      worstGap,
      recentTrend,
    };
  }, [vizData]);

  // Get recent 10 runs sorted by date
  const recentRuns = useMemo(() => {
    return [...vizData]
      .sort((a, b) => b.date.getTime() - a.date.getTime())
      .slice(0, 10);
  }, [vizData]);

  // Calculate trend lines for GAP and Efficiency
  const trendLines = useMemo(() => {
    if (vizData.length < 2) return { gapTrend: null, efficiencyTrend: null };

    const sorted = [...vizData].sort((a, b) => a.date.getTime() - b.date.getTime());

    const gapReg = calculateLinearRegression(sorted, 'gap');
    const effReg = calculateLinearRegression(sorted, 'efficiency');

    return {
      gapTrend: sorted.map((d, i) => ({
        date: d.date,
        trend: gapReg.slope * i + gapReg.intercept,
      })),
      efficiencyTrend: sorted.map((d, i) => ({
        date: d.date,
        trend: effReg.slope * i + effReg.intercept,
      }))
    };
  }, [vizData]);

  // Calculate frontier data (Best Efficiency vs Pace)
  const frontierData = useMemo(() => {
    if (vizData.length === 0) return { allTime: [], recent: [] };

    const calculateFrontier = (data: VizData[]) => {
      // Use 0.2 min/km increments for pace buckets
      const buckets: Record<string, number> = {};

      data.forEach(d => {
        const paceBucket = Math.round(d.gap * 5) / 5;
        if (!buckets[paceBucket] || d.efficiency > buckets[paceBucket]) {
          buckets[paceBucket] = d.efficiency;
        }
      });

      return Object.entries(buckets)
        .map(([pace, efficiency]) => ({ x: parseFloat(pace), y: efficiency }))
        .sort((a, b) => a.x - b.x);
    };

    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    return {
      allTime: calculateFrontier(vizData),
      recent: calculateFrontier(vizData.filter(d => d.date >= ninetyDaysAgo))
    };
  }, [vizData]);

  return {
    vizData,
    loading,
    error,
    filters,
    setFilters,
    stats,
    recentRuns,
    trendLine: trendLines.gapTrend,
    efficiencyTrend: trendLines.efficiencyTrend,
    frontierData,
  };
};
