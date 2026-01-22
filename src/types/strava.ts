/**
 * Strava Activity from Firestore
 */
export interface StravaActivity {
  id: string;
  name: string;
  type: string;
  sport_type?: string;
  distance: number; // meters
  moving_time: number; // seconds
  elapsed_time: number;
  total_elevation_gain: number; // meters
  start_date: string; // ISO timestamp
  average_speed: number; // m/s
  average_heartrate?: number; // bpm
  max_heartrate?: number; // bpm
  average_cadence?: number;
  average_watts?: number;
  kilojoules?: number;
  device_name?: string;
  elev_high?: number;
  elev_low?: number;
  suffer_score?: number;
  gap?: number; // Grade-Adjusted Pace from Strava
}

/**
 * Processed visualization data point
 */
export interface VizData {
  date: Date;
  gap: number; // Grade-Adjusted Pace in min/km
  hr: number; // Average heart rate in bpm
  distanceKm: number; // Distance in kilometers
  runName: string;
  efficiency: number; // Aerobic Efficiency (Speed/HR * 100), higher is better
  improvementPercent?: number; // % improvement from average
  elevationGain: number; // meters
  pace: number; // Actual pace min/km (not adjusted)
  activityId: string;
}

/**
 * Filter state for charts
 */
export interface ChartFilters {
  dateRange: [Date, Date];
  minDistance: number; // km
  maxDistance: number; // km
}

/**
 * Stats for the data set
 */
export interface FitnessStats {
  avgGap: number;
  avgHr: number;
  avgEfficiency: number;
  totalRuns: number;
  totalDistance: number; // km
  bestGap: number;
  worstGap: number;
  recentTrend: 'improving' | 'declining' | 'stable';
}
