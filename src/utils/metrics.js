/**
 * Athletic Performance Metrics Utility
 * 
 * Provides functions to calculate TSS, CTL, ATL, and TSB based on Strava activities
 * and athlete profile settings (HR zones, FTP, etc.)
 */

/**
 * @typedef {Object} AthleteSettings
 * @property {number} maxHeartRate
 * @property {number} restingHeartRate
 * @property {number} lthr - Lactate Threshold Heart Rate
 * @property {number} ftp - Functional Threshold Power
 */

const DEFAULT_SETTINGS = {
  maxHeartRate: 190,
  restingHeartRate: 50,
  lthr: 165,
  ftp: 200,
};

/**
 * Calculate heart rate based Training Stress Score (hrTSS) using Trimp method
 * 
 * @param {Object} activity - Strava activity object
 * @param {AthleteSettings} settings - Athlete HR settings
 * @returns {number} Calculated TSS
 */
export const calculateHrTSS = (activity, settings) => {
  const activeSettings = settings || DEFAULT_SETTINGS;
  const { moving_time, average_heartrate } = activity;
  if (!average_heartrate || moving_time <= 0) return 0;

  const hrMax = activeSettings.maxHeartRate || DEFAULT_SETTINGS.maxHeartRate;
  const hrRest = activeSettings.restingHeartRate || DEFAULT_SETTINGS.restingHeartRate;
  
  // Heart Rate Reserve Percentage
  const hrrPct = (average_heartrate - hrRest) / (hrMax - hrRest);
  
  // Trimp Factor (Exponential weighting for intensity)
  // Men: 0.64 * exp(1.92 * hrrPct)
  // Simplified generic factor for now
  const factor = 1.92;
  const trimp = (moving_time / 60) * hrrPct * 0.64 * Math.exp(factor * hrrPct);
  
  // Scale Trimp to a TSS-like value (Assuming 100 Trimp ~ 1hr at LTHR)
  // This is an estimation. Intervals.icu uses a more complex model but Trimp is a solid baseline.
  return Math.round(trimp);
};

/**
 * Calculate power based Training Stress Score (TSS)
 * TSS = (sec * NP * IF) / (FTP * 3600) * 100
 * 
 * @param {Object} activity - Strava activity object
 * @param {AthleteSettings} settings - Athlete FTP settings
 * @returns {number} Calculated TSS
 */
export const calculatePowerTSS = (activity, settings) => {
  const activeSettings = settings || DEFAULT_SETTINGS;
  const { moving_time, weighted_average_power } = activity;
  const ftp = activeSettings.ftp || DEFAULT_SETTINGS.ftp;
  
  if (!weighted_average_power || moving_time <= 0 || ftp <= 0) return 0;
  
  const np = weighted_average_power; // Strava's weighted_average_power is similar to NP
  const intensityFactor = np / ftp;
  const tss = (moving_time * np * intensityFactor) / (ftp * 3600) * 100;
  
  return Math.round(tss);
};

/**
 * Calculate the best available TSS for an activity
 * 
 * @param {Object} activity 
 * @param {AthleteSettings} settings 
 * @returns {number}
 */
export const calculateTSS = (activity, settings) => {
  const activeSettings = settings || DEFAULT_SETTINGS;
  // Prefer Power if available
  if (activity.weighted_average_power || activity.device_watts) {
    return calculatePowerTSS(activity, activeSettings);
  }
  
  // Fallback to HR
  if (activity.average_heartrate) {
    return calculateHrTSS(activity, activeSettings);
  }
  
  // Fallback to RPE/Duration estimation (1hr Moderate = ~50 TSS)
  const durationHours = (activity.moving_time || 0) / 3600;
  return Math.round(durationHours * 50);
};

/**
 * Calculate PMC (Performance Management Chart) metrics over a series of activities
 * 
 * @param {Array} activities - Sorted array of activities (oldest first)
 * @param {AthleteSettings} settings 
 * @param {Object} initialValues - Starting CTL/ATL values
 * @returns {Array} Array of PMC data points
 */
export const calculatePMC = (activities, settings = DEFAULT_SETTINGS, initialValues = { ctl: 0, atl: 0 }) => {
  if (!activities || activities.length === 0) return [];

  // Sort by date just in case
  const sortedActivities = [...activities].sort((a, b) => 
    new Date(a.start_date).getTime() - new Date(b.start_date).getTime()
  );

  let currentCTL = initialValues.ctl;
  let currentATL = initialValues.atl;
  const pmcData = [];

  // Group activities by date to handle multiple workouts in a single day
  const activitiesByDate = {};
  sortedActivities.forEach(activity => {
    const date = activity.start_date.split('T')[0];
    if (!activitiesByDate[date]) activitiesByDate[date] = 0;
    activitiesByDate[date] += calculateTSS(activity, settings);
  });

  const dates = Object.keys(activitiesByDate).sort();
  const startDate = new Date(dates[0]);
  const endDate = new Date(dates[dates.length - 1]);
  
  // Iterate through every day from start to end
  for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
    const dateStr = d.toISOString().split('T')[0];
    const dailyTSS = activitiesByDate[dateStr] || 0;

    // CTL_today = CTL_yesterday + (TSS - CTL_yesterday) / 42
    // ATL_today = ATL_yesterday + (TSS - ATL_yesterday) / 7
    currentCTL = currentCTL + (dailyTSS - currentCTL) / 42;
    currentATL = currentATL + (dailyTSS - currentATL) / 7;
    const tsb = currentCTL - currentATL;

    pmcData.push({
      date: dateStr,
      tss: dailyTSS,
      ctl: Math.round(currentCTL * 10) / 10,
      atl: Math.round(currentATL * 10) / 10,
      tsb: Math.round(tsb * 10) / 10,
    });
  }

  return pmcData;
};
