import { 
  collection, 
  doc, 
  setDoc, 
  getDocs, 
  getDoc,
  query, 
  where,
  orderBy,
  Timestamp,
  startAfter as firestoreStartAfter,
  limit as firestoreLimit,
} from 'firebase/firestore';
import { deleteDoc } from 'firebase/firestore';
import { db, ensureAuthenticated } from './firebaseConfig';
import { calculateTSS } from './metrics';
import { writeBatch } from 'firebase/firestore';

/**
 * Store Strava activities in Firebase
 * @param {string} athleteId - The Strava athlete ID
 * @param {Array} activities - Array of activity objects from Strava
 * @returns {Promise<Object>} Result object with success status and count
 */
export const storeActivitiesInFirebase = async (athleteId, activities, settings = null) => {
  if (!db) {
    throw new Error('Firebase is not initialized. Please check your Firebase configuration.');
  }

  try {
    // Ensure user is authenticated before performing database operations
    await ensureAuthenticated();
    
    let storedCount = 0;
    
    // Store each activity in Firebase
    for (const activity of activities) {
      // Use Strava activity ID as document ID to prevent duplicates
      const activityRef = doc(db, 'athletes', String(athleteId), 'activities', String(activity.id));
      
      // Prepare activity data for Firestore
      const activityData = {
        id: activity.id,
        name: activity.name,
        type: activity.type,
        distance: activity.distance,
        moving_time: activity.moving_time,
        elapsed_time: activity.elapsed_time,
        total_elevation_gain: activity.total_elevation_gain,
        sport_type: activity.sport_type || activity.type,
        start_date: activity.start_date,
        start_date_local: activity.start_date_local,
        timezone: activity.timezone,
        average_speed: activity.average_speed || 0,
        max_speed: activity.max_speed || 0,
        average_heartrate: activity.average_heartrate || 0,
        max_heartrate: activity.max_heartrate || 0,
        achievement_count: activity.achievement_count || 0,
        kudos_count: activity.kudos_count || 0,
        comment_count: activity.comment_count || 0,
        athlete_count: activity.athlete_count || 1,
        map: activity.map || {},
        start_latlng: activity.start_latlng || [],
        end_latlng: activity.end_latlng || [],
        tss: calculateTSS(activity, settings), 
  // Add timestamp for Firebase
        stored_at: Timestamp.now(),
        updated_at: Timestamp.now(),
      };

      await setDoc(activityRef, activityData, { merge: true });
      storedCount++;
    }

    return {
      success: true,
      count: storedCount,
      message: `Successfully stored ${storedCount} activities in Firebase`,
    };
  } catch (error) {
    console.error('Error storing activities in Firebase:', error);
    throw error;
  }
};

/**
 * Get activities from Firebase for a specific athlete
 * Supports optional filtering by activity type (applied client-side to avoid composite index requirement)
 * @param {string} athleteId - The Strava athlete ID
 * @param {number} limit - Maximum number of activities to retrieve
 * @param {string|null} startAfterValue - For cursor pagination, the start_date to paginate after
 * @param {string|null} activityType - Optional activity type to filter by (applied client-side)
 * @returns {Promise<Array>} Array of activity objects
 */
export const getActivitiesFromFirebase = async (athleteId, limit = 100, startAfterValue = null, activityType = null) => {
  if (!db) {
    throw new Error('Firebase is not initialized. Please check your Firebase configuration.');
  }

  try {
    // Ensure user is authenticated before performing database operations
    await ensureAuthenticated();
    
    const activitiesRef = collection(db, 'athletes', String(athleteId), 'activities');
    // Query without type filter to avoid composite index requirement
    // We'll filter by type client-side instead
    const qParts = [activitiesRef];
    qParts.push(orderBy('start_date', 'desc'));
    if (startAfterValue) {
      qParts.push(firestoreStartAfter(startAfterValue));
    }
    // Fetch more than limit if filtering by type to ensure we get enough results
    qParts.push(firestoreLimit(activityType ? limit * 2 : limit));

    const q = query(...qParts);
    const querySnapshot = await getDocs(q);
    const activities = [];

    querySnapshot.forEach((doc) => {
      const data = doc.data();
      // Apply type filter client-side
      if (activityType) {
        const actType = (data.type || data.sport_type || '').toString().toLowerCase();
        const filterType = activityType.toString().toLowerCase();
        if (actType === filterType || (filterType === 'ride' && actType.includes('ride'))) {
          activities.push(data);
        }
      } else {
        activities.push(data);
      }
    });

    return activities.slice(0, limit);
  } catch (error) {
    console.error('Error fetching activities from Firebase:', error);
    throw error;
  }
};

/**
 * Get activities from Firebase within a date range
 * @param {string} athleteId - The Strava athlete ID
 * @param {Date} startDate - Start date for filtering
 * @param {Date} endDate - End date for filtering
 * @returns {Promise<Array>} Array of activity objects
 */
export const getActivitiesByDateRange = async (athleteId, startDate, endDate) => {
  if (!db) {
    throw new Error('Firebase is not initialized. Please check your Firebase configuration.');
  }

  try {
    // Ensure user is authenticated before performing database operations
    await ensureAuthenticated();
    
    const activitiesRef = collection(db, 'athletes', String(athleteId), 'activities');
    const q = query(
      activitiesRef,
      where('start_date', '>=', startDate.toISOString()),
      where('start_date', '<=', endDate.toISOString()),
      orderBy('start_date', 'desc')
    );

    const querySnapshot = await getDocs(q);
    const activities = [];

    querySnapshot.forEach((doc) => {
      activities.push(doc.data());
    });

    return activities;
  } catch (error) {
    console.error('Error fetching activities by date range from Firebase:', error);
    throw error;
  }
};

/**
 * Delete all activities for an athlete from Firebase
 * @param {string} athleteId
 * @returns {Promise<Object>} result with count
 */
export const deleteAllActivities = async (athleteId) => {
  if (!db) {
    throw new Error('Firebase is not initialized. Please check your Firebase configuration.');
  }

  try {
    await ensureAuthenticated();

    const activitiesRef = collection(db, 'athletes', String(athleteId), 'activities');
    const querySnapshot = await getDocs(activitiesRef);
    let deletedCount = 0;

    const deletions = [];
    querySnapshot.forEach((docSnap) => {
      const docRef = doc(db, 'athletes', String(athleteId), 'activities', docSnap.id);
      deletions.push(deleteDoc(docRef));
      deletedCount++;
    });

    await Promise.all(deletions);

    return {
      success: true,
      count: deletedCount,
      message: `Deleted ${deletedCount} activities for athlete ${athleteId}`,
    };
  } catch (error) {
    console.error('Error deleting activities from Firebase:', error);
    throw error;
  }
};

/**
 * Delete a single activity from Firebase
 * @param {string} athleteId
 * @param {string|number} activityId
 * @returns {Promise<Object>}
 */
export const deleteActivityFromFirebase = async (athleteId, activityId) => {
  if (!db) throw new Error('Firebase is not initialized.');
  try {
    await ensureAuthenticated();
    const docRef = doc(db, 'athletes', String(athleteId), 'activities', String(activityId));
    await deleteDoc(docRef);
    return { success: true };
  } catch (error) {
    console.error('Error deleting activity from Firebase:', error);
    throw error;
  }
};

/**
 * Compute KPIs for a list of activities and store them in `athletes/{athleteId}/kpis/{activityType}`
 * Supported activity types: Run, Hike, Workout, Swim, Walk
 * @param {string} athleteId
 * @param {Array} activities - array of activity objects
 * @returns {Promise<Object>} result summary
 */
export const computeAndStoreKPIsFromActivities = async (athleteId, activities = []) => {
  if (!db) {
    throw new Error('Firebase is not initialized. Please check your Firebase configuration.');
  }

  try {
    await ensureAuthenticated();

    // Include 'Ride' for cycling KPIs
    const activityTypes = ['Run', 'Ride', 'Hike', 'Workout', 'Swim', 'Walk'];
    const results = {};

    for (const type of activityTypes) {
      // Match activity by 'type' or 'sport_type', case-insensitive.
      // Also accept common Ride variants (e.g., 'VirtualRide', 'EBikeRide') when looking for 'Ride'.
      const matchType = (a, t) => {
        const at = (a.type || a.sport_type || '').toString().toLowerCase();
        const tt = t.toString().toLowerCase();
        if (at === tt) return true;
        // For Ride, accept anything that contains 'ride' (e.g., 'virtualride')
        if (tt === 'ride' && at.includes('ride')) return true;
        return false;
      };

      const filtered = activities.filter((a) => matchType(a, type));
      const totalCount = filtered.length;

      const kpi = {
        activityType: type,
        totalCount,
        longest: null,
        mostElevation: null,
        fastest: null,
        lastUpdated: Timestamp.now(),
      };

      if (totalCount > 0) {
        // Longest (by distance)
        const longest = filtered.reduce((best, curr) => {
          return (curr.distance || 0) > (best.distance || 0) ? curr : best;
        }, filtered[0]);

        // Most Elevation
        const mostElevation = filtered.reduce((best, curr) => {
          return (curr.total_elevation_gain || 0) > (best.total_elevation_gain || 0) ? curr : best;
        }, filtered[0]);

        // Fastest (by average_speed)
        const fastest = filtered.reduce((best, curr) => {
          const currSpeed = curr.average_speed || 0;
          const bestSpeed = best.average_speed || 0;
          return currSpeed > bestSpeed ? curr : best;
        }, filtered[0]);

        kpi.longest = {
          id: longest.id,
          name: longest.name,
          distance: longest.distance,
          moving_time: longest.moving_time,
          start_date: longest.start_date,
        };

        kpi.mostElevation = {
          id: mostElevation.id,
          name: mostElevation.name,
          total_elevation_gain: mostElevation.total_elevation_gain,
          distance: mostElevation.distance,
          start_date: mostElevation.start_date,
        };

        kpi.fastest = {
          id: fastest.id,
          name: fastest.name,
          average_speed: fastest.average_speed || 0,
          distance: fastest.distance,
          start_date: fastest.start_date,
        };
      }

      // store KPI doc
      const kpiRef = doc(db, 'athletes', String(athleteId), 'kpis', type);
      await setDoc(kpiRef, kpi, { merge: true });
      results[type] = kpi;
    }

    return { success: true, results };
  } catch (error) {
    console.error('Error computing/storing KPIs:', error);
    throw error;
  }
};

/**
 * Sync provided activities into Firebase (store each activity) and compute KPIs
 * This is a convenience wrapper that stores activities and then computes KPIs
 * @param {string} athleteId
 * @param {Array} activities
 */
export const syncActivitiesAndComputeKPIs = async (athleteId, activities = []) => {
  if (!db) throw new Error('Firebase is not initialized.');

  try {
    await ensureAuthenticated();

    // Store activities (reuses existing function)
    const storeResult = await storeActivitiesInFirebase(athleteId, activities);

    // Compute KPIs from the stored activities (use passed activities to avoid refetch)
    const kpiResult = await computeAndStoreKPIsFromActivities(athleteId, activities);

    return { success: true, storeResult, kpiResult };
  } catch (error) {
    console.error('Error in full sync + KPI:', error);
    throw error;
  }
};

/**
 * Get KPI documents for an athlete
 * @param {string} athleteId
 * @returns {Promise<Object>} map of activityType -> kpi doc data
 */
export const getKPIsForAthlete = async (athleteId) => {
  if (!db) throw new Error('Firebase is not initialized.');

  try {
    await ensureAuthenticated();

    const kpisRef = collection(db, 'athletes', String(athleteId), 'kpis');
    const snapshot = await getDocs(kpisRef);
    const result = {};
    snapshot.forEach((docSnap) => {
      result[docSnap.id] = docSnap.data();
    });
    return result;
  } catch (error) {
    console.error('Error fetching KPIs for athlete:', error);
    throw error;
  }
};

/**
 * Get a single activity document from Firebase for an athlete
 * @param {string} athleteId
 * @param {string|number} activityId
 * @returns {Promise<Object|null>} activity data or null if not found
 */
export const getActivityFromFirebase = async (athleteId, activityId) => {
  if (!db) throw new Error('Firebase is not initialized.');

  try {
    await ensureAuthenticated();
    const activityRef = doc(db, 'athletes', String(athleteId), 'activities', String(activityId));
    const snap = await getDoc(activityRef);
    if (!snap.exists()) return null;
    return snap.data();
  } catch (error) {
    console.error('Error fetching activity from Firebase:', error);
    throw error;
  }
};

/**
 * Get Strava stats from Firebase if they were cached today, otherwise return null
 * @param {string|number} athleteId
 * @returns {Promise<Object|null>} Cached stats if available and from today, otherwise null
 */
export const getStravaStatsFromFirebase = async (athleteId) => {
  if (!db) throw new Error('Firebase is not initialized.');

  try {
    await ensureAuthenticated();
    const statsRef = doc(db, 'athletes', String(athleteId), 'cached_data', 'strava_stats');
    const snap = await getDoc(statsRef);
    
    if (!snap.exists()) return null;

    const data = snap.data();
    if (!data.updated_at) return null;

    // Check if the cached data is from today
    const lastUpdate = data.updated_at.toDate ? data.updated_at.toDate() : new Date(data.updated_at);
    const today = new Date();
    const isSameDay = 
      lastUpdate.getFullYear() === today.getFullYear() &&
      lastUpdate.getMonth() === today.getMonth() &&
      lastUpdate.getDate() === today.getDate();

    if (!isSameDay) return null;

    return data.stats;
  } catch (error) {
    console.error('Error fetching cached stats from Firebase:', error);
    return null;
  }
};

/**
 * Store Strava stats in Firebase with update timestamp
 * @param {string|number} athleteId
 * @param {Object} stats - Athlete stats object from Strava
 * @returns {Promise<Object>} Result object with success status
 */
export const storeStravaStatsInFirebase = async (athleteId, stats) => {
  if (!db) throw new Error('Firebase is not initialized.');

  try {
    await ensureAuthenticated();
    const statsRef = doc(db, 'athletes', String(athleteId), 'cached_data', 'strava_stats');
    
    await setDoc(statsRef, {
      stats,
      updated_at: Timestamp.now(),
    }, { merge: true });

    return { success: true, message: 'Stats cached in Firebase' };
  } catch (error) {
    console.error('Error storing stats in Firebase:', error);
    throw error;
  }
};

/**
 * Get year statistics from Firebase activities
 * Computes stats for a specific year including totals, by type, by month, and highlights
 * @param {string} athleteId - The Strava athlete ID
 * @param {number} year - The year to get stats for (e.g., 2025)
 * @returns {Promise<Object>} Year statistics object
 */
export const getYearStatsFromFirebase = async (athleteId, year) => {
  if (!db) throw new Error('Firebase is not initialized.');

  try {
    await ensureAuthenticated();

    // Get activities for the specified year
    const startDate = new Date(year, 0, 1); // January 1st
    const endDate = new Date(year, 11, 31, 23, 59, 59); // December 31st

    const activities = await getActivitiesByDateRange(athleteId, startDate, endDate);

    // Initialize stats object
    const stats = {
      year,
      summary: {
        totalActivities: activities.length,
        totalDistance: 0,
        totalMovingTime: 0,
        totalElevation: 0,
      },
      byType: {},
      byMonth: {},
      biggestDay: null,
    };

    // Initialize months
    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    monthNames.forEach(month => {
      stats.byMonth[month] = {
        count: 0,
        distance: 0,
        movingTime: 0,
        elevation: 0,
      };
    });

    // Track activities by day for biggest day calculation
    const dayStats = {};

    // Process each activity
    activities.forEach(activity => {
      const distance = activity.distance || 0;
      const movingTime = activity.moving_time || 0;
      const elevation = activity.total_elevation_gain || 0;
      const type = activity.type || activity.sport_type || 'Other';
      const activityDate = new Date(activity.start_date_local || activity.start_date);
      const monthIndex = activityDate.getMonth();
      const monthName = monthNames[monthIndex];
      const dateKey = activityDate.toISOString().split('T')[0]; // YYYY-MM-DD

      // Update summary
      stats.summary.totalDistance += distance;
      stats.summary.totalMovingTime += movingTime;
      stats.summary.totalElevation += elevation;

      // Update by type
      if (!stats.byType[type]) {
        stats.byType[type] = {
          count: 0,
          distance: 0,
          movingTime: 0,
          elevation: 0,
        };
      }
      stats.byType[type].count += 1;
      stats.byType[type].distance += distance;
      stats.byType[type].movingTime += movingTime;
      stats.byType[type].elevation += elevation;

      // Update by month
      stats.byMonth[monthName].count += 1;
      stats.byMonth[monthName].distance += distance;
      stats.byMonth[monthName].movingTime += movingTime;
      stats.byMonth[monthName].elevation += elevation;

      // Track daily stats for biggest day
      if (!dayStats[dateKey]) {
        dayStats[dateKey] = {
          date: dateKey,
          count: 0,
          distance: 0,
        };
      }
      dayStats[dateKey].count += 1;
      dayStats[dateKey].distance += distance;
    });

    // Find biggest day (by distance)
    const days = Object.values(dayStats);
    if (days.length > 0) {
      stats.biggestDay = days.reduce((max, day) => 
        day.distance > max.distance ? day : max
      );
    }

    // Remove months with no activities for cleaner display
    Object.keys(stats.byMonth).forEach(month => {
      if (stats.byMonth[month].count === 0) {
        delete stats.byMonth[month];
      }
    });

    return stats;
  } catch (error) {
    console.error('Error fetching year stats from Firebase:', error);
    throw error;
  }
};

/**
 * Get athlete settings (HR zones, FTP, etc.)
 * @param {string} athleteId 
 * @returns {Promise<Object|null>}
 */
export const getAthleteSettings = async (athleteId) => {
  if (!db) throw new Error('Firebase is not initialized.');
  try {
    await ensureAuthenticated();
    const settingsRef = doc(db, 'athletes', String(athleteId), 'profile', 'settings');
    const snap = await getDoc(settingsRef);
    return snap.exists() ? snap.data() : null;
  } catch (error) {
    console.error('Error fetching athlete settings:', error);
    return null;
  }
};

/**
 * Update athlete settings
 * @param {string} athleteId 
 * @param {Object} settings 
 */
export const updateAthleteSettings = async (athleteId, settings) => {
  if (!db) throw new Error('Firebase is not initialized.');
  try {
    await ensureAuthenticated();
    const settingsRef = doc(db, 'athletes', String(athleteId), 'profile', 'settings');
    await setDoc(settingsRef, {
      ...settings,
      updated_at: Timestamp.now(),
    }, { merge: true });
    return { success: true };
  } catch (error) {
    console.error('Error updating athlete settings:', error);
    throw error;
  }
};
/**
 * Recalculate TSS for all activities in Firebase using the latest logic
 * @param {string} athleteId
 * @returns {Promise<Object>} result with count
 */
export const recalculateAllActivityTSS = async (athleteId) => {
  if (!db) throw new Error('Firebase is not initialized.');
  try {
    await ensureAuthenticated();
    
    // Get all activities
    const activities = await getActivitiesFromFirebase(athleteId, 2000); // Fetch up to 2000
    const settings = await getAthleteSettings(athleteId);
    
    let updatedCount = 0;
    const batchSize = 500;
    
    // Process in batches
    for (let i = 0; i < activities.length; i += batchSize) {
      const batch = writeBatch(db);
      const chunk = activities.slice(i, i + batchSize);
      let changesInBatch = 0;
      
      chunk.forEach(activity => {
        const newTSS = calculateTSS(activity, settings);
        // Only update if TSS has changed significantly (or if it was missing)
        if (Math.abs((activity.tss || 0) - newTSS) > 1 || activity.tss === undefined) {
          const docRef = doc(db, 'athletes', String(athleteId), 'activities', String(activity.id));
          batch.update(docRef, { 
            tss: newTSS,
            updated_at: Timestamp.now()
          });
          changesInBatch++;
          updatedCount++;
        }
      });
      
      if (changesInBatch > 0) {
        await batch.commit();
      }
    }

    return { success: true, count: updatedCount, totalScanned: activities.length };
  } catch (error) {
    console.error('Error recalculating TSS:', error);
    throw error;
  }
};
