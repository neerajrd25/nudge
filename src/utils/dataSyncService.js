import {
  getAthlete,
  getAthleteStats,
  getAthleteActivitiesLast3Months,
  getAthleteActivitiesSince,
  refreshAccessToken,
  storeAuthData,
  isTokenExpired,
} from './stravaApi';
import {
  storeActivitiesInFirebase,
  storeAthleteProfile,
  storeAthleteStats,
  storeSyncStatus,
  getSyncStatus,
} from './firebaseService';

/**
 * Comprehensive data synchronization service
 * Handles pulling data from Strava and storing in Firebase
 */

/**
 * Sync all athlete data from Strava to Firebase
 * @param {Object} authData - Strava authentication data
 * @param {Function} onProgress - Progress callback function
 * @returns {Promise<Object>} Sync result with success status and details
 */
export const syncAllDataToFirebase = async (authData, onProgress = null, startDate = null) => {
  if (!authData || !authData.accessToken) {
    throw new Error('No valid authentication data provided');
  }

  let accessToken = authData.accessToken;
  const athleteId = authData.athlete?.id;

  if (!athleteId) {
    throw new Error('No athlete ID found in authentication data');
  }

  try {
    // Refresh token if expired
    if (isTokenExpired() && authData.refreshToken) {
      onProgress?.('Refreshing access token...');
      const newAuthData = await refreshAccessToken(authData.refreshToken);
      storeAuthData(newAuthData);
      accessToken = newAuthData.access_token;
    }

    const syncResults = {
      athlete: null,
      stats: null,
      activities: null,
      errors: [],
    };

    // 1. Sync athlete profile
    try {
      onProgress?.('Fetching athlete profile...');
      const athleteProfile = await getAthlete(accessToken);
      
      onProgress?.('Storing athlete profile...');
      await storeAthleteProfile(String(athleteId), athleteProfile);
      syncResults.athlete = { success: true, data: athleteProfile };
      
    } catch (error) {
      console.error('Error syncing athlete profile:', error);
      syncResults.errors.push(`Athlete profile sync failed: ${error.message}`);
      syncResults.athlete = { success: false, error: error.message };
    }

    // 2. Sync athlete stats
    try {
      onProgress?.('Fetching athlete stats...');
      const athleteStats = await getAthleteStats(accessToken, athleteId);
      
      onProgress?.('Storing athlete stats...');
      await storeAthleteStats(String(athleteId), athleteStats);
      syncResults.stats = { success: true, data: athleteStats };
      
    } catch (error) {
      console.error('Error syncing athlete stats:', error);
      syncResults.errors.push(`Athlete stats sync failed: ${error.message}`);
      syncResults.stats = { success: false, error: error.message };
    }

    // 3. Sync activities (last 3 months)
    try {
      onProgress?.('Fetching activities from Strava...');
      let activities = [];
      if (startDate) {
        // If startDate provided, fetch activities since that date
        const afterTimestamp = Math.floor(new Date(startDate).getTime() / 1000);
        activities = await getAthleteActivitiesSince(accessToken, afterTimestamp);
      } else {
        activities = await getAthleteActivitiesLast3Months(accessToken);
      }
      
      onProgress?.(`Storing ${activities.length} activities...`);
      const result = await storeActivitiesInFirebase(String(athleteId), activities);
      syncResults.activities = { 
        success: true, 
        count: result.count, 
        message: result.message 
      };
      
    } catch (error) {
      console.error('Error syncing activities:', error);
      syncResults.errors.push(`Activities sync failed: ${error.message}`);
      syncResults.activities = { success: false, error: error.message };
    }

    // 4. Store sync status
    const syncStatus = {
      lastSyncTime: new Date().toISOString(),
      success: syncResults.errors.length === 0,
      errors: syncResults.errors,
      syncResults,
    };

    try {
      await storeSyncStatus(String(athleteId), syncStatus);
    } catch (error) {
      console.error('Error storing sync status:', error);
    }

    onProgress?.('Data synchronization completed!');

    return {
      success: syncResults.errors.length === 0,
      results: syncResults,
      errors: syncResults.errors,
      lastSyncTime: syncStatus.lastSyncTime,
    };

  } catch (error) {
    console.error('Error in data synchronization:', error);
    
    // Try to store error status
    try {
      const errorStatus = {
        lastSyncTime: new Date().toISOString(),
        success: false,
        errors: [error.message],
        syncResults: null,
      };
      await storeSyncStatus(String(athleteId), errorStatus);
    } catch (statusError) {
      console.error('Error storing error status:', statusError);
    }

    throw error;
  }
};

/**
 * Quick sync for specific data types
 * @param {Object} authData - Strava authentication data
 * @param {Array} dataTypes - Array of data types to sync ['athlete', 'stats', 'activities']
 * @param {Function} onProgress - Progress callback function
 * @returns {Promise<Object>} Sync result
 */
export const quickSync = async (authData, dataTypes = ['activities'], onProgress = null) => {
  if (!authData || !authData.accessToken) {
    throw new Error('No valid authentication data provided');
  }

  let accessToken = authData.accessToken;
  const athleteId = authData.athlete?.id;

  if (!athleteId) {
    throw new Error('No athlete ID found in authentication data');
  }

  // Refresh token if expired
  if (isTokenExpired() && authData.refreshToken) {
    onProgress?.('Refreshing access token...');
    const newAuthData = await refreshAccessToken(authData.refreshToken);
    storeAuthData(newAuthData);
    accessToken = newAuthData.access_token;
  }

  const results = {};

  for (const dataType of dataTypes) {
    try {
      switch (dataType) {
        case 'athlete':
          onProgress?.('Syncing athlete profile...');
          const athleteProfile = await getAthlete(accessToken);
          await storeAthleteProfile(String(athleteId), athleteProfile);
          results.athlete = { success: true };
          break;

        case 'stats':
          onProgress?.('Syncing athlete stats...');
          const athleteStats = await getAthleteStats(accessToken, athleteId);
          await storeAthleteStats(String(athleteId), athleteStats);
          results.stats = { success: true };
          break;

        case 'activities':
          onProgress?.('Syncing activities...');
          // quickSync can accept a startDate by including it in authData._syncStartDate (optional)
          let activities = [];
          const startDate = authData?._syncStartDate || null;
          if (startDate) {
            const afterTimestamp = Math.floor(new Date(startDate).getTime() / 1000);
            activities = await getAthleteActivitiesSince(accessToken, afterTimestamp);
          } else {
            activities = await getAthleteActivitiesLast3Months(accessToken);
          }
          const result = await storeActivitiesInFirebase(String(athleteId), activities);
          results.activities = { success: true, count: result.count };
          break;

        default:
          console.warn(`Unknown data type: ${dataType}`);
      }
    } catch (error) {
      console.error(`Error syncing ${dataType}:`, error);
      results[dataType] = { success: false, error: error.message };
    }
  }

  return results;
};

/**
 * Check if data needs to be synced (based on last sync time)
 * @param {string} athleteId - The athlete ID
 * @param {number} maxAgeHours - Maximum age in hours before sync is needed
 * @returns {Promise<boolean>} True if sync is needed
 */
export const needsSync = async (athleteId, maxAgeHours = 24) => {
  try {
    const syncStatus = await getSyncStatus(athleteId);
    
    if (!syncStatus || !syncStatus.lastSyncTime) {
      return true; // Never synced before
    }

    const lastSync = new Date(syncStatus.lastSyncTime);
    const maxAge = new Date(Date.now() - maxAgeHours * 60 * 60 * 1000);
    
    return lastSync < maxAge;
  } catch (error) {
    console.error('Error checking sync status:', error);
    return true; // Assume sync is needed if we can't check
  }
};

/**
 * Auto-sync data if needed
 * @param {Object} authData - Strava authentication data
 * @param {number} maxAgeHours - Maximum age in hours before sync is triggered
 * @param {Function} onProgress - Progress callback function
 * @returns {Promise<Object|null>} Sync result or null if sync wasn't needed
 */
export const autoSync = async (authData, maxAgeHours = 24, onProgress = null) => {
  const athleteId = authData?.athlete?.id;
  
  if (!athleteId) {
    throw new Error('No athlete ID found in authentication data');
  }

  const shouldSync = await needsSync(String(athleteId), maxAgeHours);
  
  if (!shouldSync) {
    onProgress?.('Data is up to date, no sync needed');
    return null;
  }

  onProgress?.('Data sync needed, starting synchronization...');
  return await syncAllDataToFirebase(authData, onProgress);
};