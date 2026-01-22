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
  let tss = 0;

  // Prefer Power if available
  if (activity.weighted_average_power || activity.device_watts) {
    tss = calculatePowerTSS(activity, activeSettings);
  }
  // Fallback to HR
  else if (activity.average_heartrate) {
    tss = calculateHrTSS(activity, activeSettings);
  }
  // Fallback to RPE/Duration estimation (1hr Moderate = ~50 TSS)
  else {
    const durationHours = (activity.moving_time || 0) / 3600;
    tss = Math.round(durationHours * 50);
  }

  return isNaN(tss) ? 0 : tss;
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

/**
 * Calculate readiness score based on training load and recovery indicators
 * Returns a score from 0-100 where higher is better readiness
 * @param {Array} activities - Array of activity objects
 * @param {Object} settings - Athlete settings
 * @returns {Object} Readiness score data with score, label, and color
 */
export const calculateReadinessScore = (activities, settings = DEFAULT_SETTINGS) => {
  if (!activities || activities.length === 0) {
    return { score: 50, label: 'Unknown', color: 'gray' };
  }

  // Get PMC data for the last 30 days
  const pmcData = calculatePMC(activities, settings);
  if (pmcData.length === 0) {
    return { score: 50, label: 'Unknown', color: 'gray' };
  }

  // Get the most recent TSB value
  const latestPMC = pmcData[pmcData.length - 1];
  const currentTSB = latestPMC.tsb;

  // Base score on TSB (normalized to 0-100 scale)
  // TSB range: typically -30 to +30, we'll map this to readiness
  let readinessScore = 50 + (currentTSB * 1.5); // 50 is neutral, ±30 TSB gives ±45 points
  readinessScore = Math.max(0, Math.min(100, readinessScore)); // Clamp to 0-100

  // Factor in recent activity intensity (last 3 days)
  const recentActivities = activities
    .filter(activity => {
      const activityDate = new Date(activity.start_date);
      const threeDaysAgo = new Date();
      threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
      return activityDate >= threeDaysAgo;
    })
    .sort((a, b) => new Date(b.start_date) - new Date(a.start_date));

  // If had high intensity workout recently, slightly reduce readiness
  const highIntensityThreshold = 150; // TSS threshold for "high intensity"
  const recentHighIntensity = recentActivities.some(activity =>
    (activity.tss || calculateTSS(activity, settings)) > highIntensityThreshold
  );

  if (recentHighIntensity) {
    readinessScore = Math.max(0, readinessScore - 10); // Reduce by 10 points
  }

  // Factor in rest days - if last activity was >2 days ago, boost readiness slightly
  const lastActivityDate = recentActivities.length > 0 ?
    new Date(recentActivities[0].start_date) : new Date();
  const daysSinceLastActivity = (new Date() - lastActivityDate) / (1000 * 60 * 60 * 24);

  if (daysSinceLastActivity > 2) {
    readinessScore = Math.min(100, readinessScore + 5); // Boost by 5 points for rest
  }

  // Determine label and color based on score
  let label, color;
  if (readinessScore >= 80) {
    label = 'Peak Ready';
    color = 'green';
  } else if (readinessScore >= 65) {
    label = 'Good Recovery';
    color = 'blue';
  } else if (readinessScore >= 50) {
    label = 'Maintaining';
    color = 'yellow';
  } else if (readinessScore >= 35) {
    label = 'Fatigued';
    color = 'orange';
  } else {
    label = 'Overtrained';
    color = 'red';
  }

  return {
    score: Math.round(readinessScore),
    label,
    color,
    tsb: currentTSB,
    daysSinceLastActivity: Math.round(daysSinceLastActivity * 10) / 10
  };
};

/**
 * Identify activity type from activity name/details or provided type
 * @param {Object} item - Activity or planned workout object
 * @returns {string} Normalized activity type
 */
export const getActivityType = (item) => {
  const rawType = (item.activityType || item.type || item.sport_type || '').toLowerCase();
  if (rawType.includes('run')) return 'run';
  if (rawType.includes('ride') || rawType.includes('cycle') || rawType.includes('bike')) return 'cycle';
  if (rawType.includes('swim')) return 'swim';
  if (rawType.includes('strength') || rawType.includes('weight') || rawType.includes('gym')) return 'strength';
  if (rawType.includes('yoga') || rawType.includes('mobility')) return 'mobility';
  if (rawType.includes('rest')) return 'rest';

  const name = (item.plannedActivity || item.name || '').toLowerCase();
  const details = (item.details || '').toLowerCase();
  const combined = `${name} ${details}`;
  
  if (combined.includes('run')) return 'run';
  if (combined.includes('ride') || combined.includes('cycle') || combined.includes('spin') || combined.includes('bike')) return 'cycle';
  if (combined.includes('swim')) return 'swim';
  if (combined.includes('strength') || combined.includes('gym') || combined.includes('lift') || combined.includes('weight')) return 'strength';
  if (combined.includes('mobility') || combined.includes('rehab') || combined.includes('yoga') || combined.includes('stretch')) return 'mobility';
  if (combined.includes('rest')) return 'rest';
  
  return 'run'; // Default
};

/**
 * Estimate TSS for a planned activity based on duration and type
 * @param {Object} item - Planned workout object
 * @returns {number} Estimated TSS
 */
export const estimatePlannedTSS = (item) => {
  // 1. Prioritize explicitly set planned TSS if available
  if (item.plannedTss !== undefined && item.plannedTss !== null && item.plannedTss !== '') {
    const val = parseFloat(item.plannedTss);
    if (!isNaN(val)) return Math.round(val);
  }

  // 2. Fallback to actual TSS if the status is done and it exists
  if (item.status === 'done' && (item.actualTss !== undefined || item.tss !== undefined)) {
    const val = parseFloat(item.actualTss || item.tss);
    if (!isNaN(val)) return Math.round(val);
  }

  const durationHours = parseFloat(item.plannedDuration || 0) / 60;
  if (isNaN(durationHours) || durationHours <= 0) return 0;
  
  const type = getActivityType(item);
  let baseTSSPerHour = 50;
  
  // Calculate speed if distance is available
  const distanceKm = parseFloat(item.plannedDistance);
  const hasDistance = !isNaN(distanceKm) && distanceKm > 0;
  const speed = hasDistance ? distanceKm / durationHours : 0; // km/h

  // Activity specific baselines and speed adjustments
  const context = `${item.plannedActivity} ${item.details || ''}`.toLowerCase();

  if (type === 'run') {
    // Baseline: 10km/h (6:00/km) ~ 50 TSS/hr
    const refSpeed = 10;
    
    if (hasDistance) {
       // Scale intensity by speed^2 roughly, but linearly is safer for estimation
       // Faster running is exponentially harder, but TSS is roughly linear with Work? 
       // TSS = Intensity^2 * Duration. Intensity ~ Speed. So Speed^2.
       // Let's use a simpler linear scaling from the baseline for robustness
       baseTSSPerHour = 50 * (speed / refSpeed);
    } else {
      if (context.includes('easy') || context.includes('recovery')) baseTSSPerHour = 30;
      else if (context.includes('tempo') || context.includes('threshold')) baseTSSPerHour = 75;
      else if (context.includes('interval') || context.includes('speed')) baseTSSPerHour = 95;
      else if (context.includes('race')) baseTSSPerHour = 105;
    }
  } else if (type === 'cycle') {
    // Baseline: 25km/h ~ 50 TSS/hr
    const refSpeed = 25;
    
    if (hasDistance) {
       baseTSSPerHour = 50 * (speed / refSpeed);
    } else {
      if (context.includes('easy') || context.includes('recovery')) baseTSSPerHour = 40;
      else if (context.includes('tempo') || context.includes('steady')) baseTSSPerHour = 65;
      else if (context.includes('interval') || context.includes('race')) baseTSSPerHour = 90;
    }
  } else if (type === 'swim') {
      // Baseline: 2.5km/h (2:24/100m) ~ 50 TSS/hr
      // This is quite slow for a swimmer, but "moderate" for general pop?
      // A good swimmer does 3km/h (2:00/100m). Let's use 2.5
      const refSpeed = 2.5; 
      if (hasDistance) {
        baseTSSPerHour = 50 * (speed / refSpeed);
      }
  } else if (type === 'strength') {
    baseTSSPerHour = 35;
  } else if (type === 'rest' || type === 'mobility') {
    baseTSSPerHour = 5;
  }
  
  // Cap extreme values to prevent crazy TSS from typos
  baseTSSPerHour = Math.max(5, Math.min(150, baseTSSPerHour));

  return Math.round(durationHours * baseTSSPerHour);
};
