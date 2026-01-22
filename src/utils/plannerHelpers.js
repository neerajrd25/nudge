/**
 * Planner Helper Functions
 * Utilities for parsing and transforming training plan data
 */

/**
 * Convert training plan CSV format to Planner format
 * Maps the Training_plan.csv structure to PlannerItem structure
 * 
 * @param {string} csvString - Raw CSV string from Training_plan.csv
 * @returns {string} - Reformatted CSV string compatible with Planner component
 */
export function convertTrainingPlanToPlannerFormat(csvString) {
  if (!csvString) return '';

  const lines = csvString.trim().split('\n');
  if (lines.length < 2) return '';

  const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
  const plannerRows = ['date,plannedActivity,plannedDuration,actualActivity,actualDuration,status'];

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map(v => v.trim());
    const row = {};
    
    headers.forEach((header, index) => {
      row[header] = values[index] || '';
    });

    // Extract date (column: Date)
    const date = row.date || '';
    if (!date) continue;

    // Extract planned activity (column: Activity)
    const plannedActivity = row.activity || '';
    
    // Extract distance/details (column: Distance/Details)
    const details = row['distance/details'] || '';
    
    // Combine activity with details for full description
    const fullActivity = details ? `${plannedActivity} - ${details}` : plannedActivity;
    
    // Estimate duration based on activity type (you can customize this)
    const plannedDuration = estimateDuration(plannedActivity, details);
    
    // Default to pending status
    const status = 'pending';

    // Build planner CSV row
    plannerRows.push(
      `${date},${fullActivity},${plannedDuration},,,${status}`
    );
  }

  return plannerRows.join('\n');
}

/**
 * Estimate activity duration based on activity type and details
 * You can customize these estimates based on your training patterns
 * 
 * @param {string} activity - Activity type (e.g., "Run", "Cycle", "Rest")
 * @param {string} details - Activity details (e.g., "10km Easy")
 * @returns {number} - Estimated duration in minutes
 */
function estimateDuration(activity, details) {
  const activityLower = activity.toLowerCase();
  const detailsLower = details.toLowerCase();

  // Extract distance if mentioned
  const kmMatch = details.match(/(\d+)km/);
  const distance = kmMatch ? parseInt(kmMatch[1]) : 0;

  if (activityLower.includes('run')) {
    // Estimate ~6 min/km for easy runs, ~5 min/km for tempo
    if (detailsLower.includes('easy')) {
      return distance * 6;
    } else if (detailsLower.includes('steady') || detailsLower.includes('tempo')) {
      return distance * 5;
    } else if (distance > 0) {
      return distance * 5.5;
    }
    return 45; // Default run duration
  }

  if (activityLower.includes('cycle') || activityLower.includes('ride')) {
    // Estimate ~2 min/km for cycling
    return distance > 0 ? distance * 2 : 90;
  }

  if (activityLower.includes('spin')) {
    // Extract minutes if mentioned (e.g., "30m Spin")
    const minMatch = details.match(/(\d+)m\s/i);
    return minMatch ? parseInt(minMatch[1]) : 45;
  }

  if (activityLower.includes('strength')) {
    return 45;
  }

  if (activityLower.includes('mobility') || activityLower.includes('rehab')) {
    return 20;
  }

  if (activityLower.includes('rest')) {
    return 0;
  }

  // Default duration
  return 30;
}

/**
 * Load and parse Training_plan.csv file
 * 
 * @param {string} filePath - Path to the CSV file
 * @returns {Promise<string>} - Converted CSV string for Planner
 */
export async function loadTrainingPlanFromFile(filePath) {
  try {
    const response = await fetch(filePath);
    const csvText = await response.text();
    return convertTrainingPlanToPlannerFormat(csvText);
  } catch (error) {
    console.error('Error loading training plan:', error);
    return '';
  }
}

/**
 * Fetch actual activity data from Strava API and merge with plan
 * TODO: Implement Strava API integration
 * 
 * @param {string} dateFrom - Start date (YYYY-MM-DD)
 * @param {string} dateTo - End date (YYYY-MM-DD)
 * @returns {Promise<Object>} - Map of date -> actual activity data
 */
export async function fetchActualActivitiesFromStrava(dateFrom, dateTo) {
  console.log('TODO: Implement Strava API integration', { dateFrom, dateTo });
  
  // TODO: Use your existing stravaApi.js utilities
  // import { getActivities } from './stravaApi';
  // 
  // try {
  //   const activities = await getActivities(dateFrom, dateTo);
  //   return activities.reduce((acc, activity) => {
  //     const date = activity.start_date.split('T')[0];
  //     acc[date] = {
  //       actualActivity: activity.name,
  //       actualDuration: Math.round(activity.moving_time / 60), // seconds to minutes
  //       actualDistance: activity.distance / 1000, // meters to km
  //     };
  //     return acc;
  //   }, {});
  // } catch (error) {
  //   console.error('Error fetching Strava activities:', error);
  //   return {};
  // }

  return {};
}

/**
 * Merge planned and actual activities
 * 
 * @param {Array} plannedItems - Array of PlannerItem with planned data
 * @param {Object} actualData - Map of date -> actual activity data from Strava
 * @returns {Array} - Merged array with actual data and updated status
 */
export function mergePlannedWithActual(plannedItems, actualData) {
  return plannedItems.map(item => {
    const actual = actualData[item.date];
    if (!actual) return item;

    return {
      ...item,
      actualActivity: actual.actualActivity,
      actualDuration: actual.actualDuration,
      status: 'done', // Mark as done if there's actual data
    };
  });
}
