import { 
  collection, 
  doc, 
  setDoc, 
  getDocs, 
  getDoc,
  query, 
  where,
  orderBy,
  Timestamp 
} from 'firebase/firestore';
import { db, ensureAuthenticated } from './firebaseConfig';

/**
 * Store Strava activities in Firebase
 * @param {string} athleteId - The Strava athlete ID
 * @param {Array} activities - Array of activity objects from Strava
 * @returns {Promise<Object>} Result object with success status and count
 */
export const storeActivitiesInFirebase = async (athleteId, activities) => {
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
      const activityRef = doc(db, 'athletes', athleteId, 'activities', String(activity.id));
      
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
 * @param {string} athleteId - The Strava athlete ID
 * @param {number} limit - Maximum number of activities to retrieve
 * @returns {Promise<Array>} Array of activity objects
 */
export const getActivitiesFromFirebase = async (athleteId, limit = 100) => {
  if (!db) {
    throw new Error('Firebase is not initialized. Please check your Firebase configuration.');
  }

  try {
    // Ensure user is authenticated before performing database operations
    await ensureAuthenticated();
    
    const activitiesRef = collection(db, 'athletes', athleteId, 'activities');
    const q = query(
      activitiesRef,
      orderBy('start_date', 'desc')
    );

    const querySnapshot = await getDocs(q);
    const activities = [];

    querySnapshot.forEach((doc) => {
      activities.push(doc.data());
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
    
    const activitiesRef = collection(db, 'athletes', athleteId, 'activities');
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
 * Compute personal records (PRs) per sport from stored activities.
 * PRs returned per sport include: total_activities, longest_distance, max_average_speed, max_total_elevation_gain
 * Each PR includes the activity id, name and start_date where it occurred.
 * @param {string} athleteId
 * @returns {Promise<Object>} Object keyed by sport type
 */
export const getPersonalRecords = async (athleteId) => {
  if (!db) {
    throw new Error('Firebase is not initialized. Please check your Firebase configuration.');
  }

  try {
    await ensureAuthenticated();

    const activitiesRef = collection(db, 'athletes', athleteId, 'activities');
    const q = query(activitiesRef, orderBy('start_date', 'desc'));
    const querySnapshot = await getDocs(q);

    const sports = {};

    querySnapshot.forEach((docSnap) => {
      const a = docSnap.data();
      const sport = a.sport_type || a.type || 'Unknown';

      if (!sports[sport]) {
        sports[sport] = {
          total_activities: 0,
          longest_distance: { value: 0, activity: null },
          max_average_speed: { value: 0, activity: null },
          max_total_elevation_gain: { value: 0, activity: null },
        };
      }

      const s = sports[sport];
      s.total_activities += 1;

      if (typeof a.distance === 'number' && a.distance > s.longest_distance.value) {
        s.longest_distance = { value: a.distance, activity: { id: a.id, name: a.name, start_date: a.start_date } };
      }

      if (typeof a.average_speed === 'number' && a.average_speed > s.max_average_speed.value) {
        s.max_average_speed = { value: a.average_speed, activity: { id: a.id, name: a.name, start_date: a.start_date } };
      }

      if (typeof a.total_elevation_gain === 'number' && a.total_elevation_gain > s.max_total_elevation_gain.value) {
        s.max_total_elevation_gain = { value: a.total_elevation_gain, activity: { id: a.id, name: a.name, start_date: a.start_date } };
      }
    });

    return sports;
  } catch (error) {
    console.error('Error computing personal records from Firebase:', error);
    throw error;
  }
};

/**
 * Compute running PRs for standard distances.
 * For each target distance, we prefer activities within 5% of the distance (exact match).
 * If none, we estimate the time from any activity longer than the distance by scaling the moving_time.
 * @param {string} athleteId
 * @returns {Promise<Object>} PRs keyed by distance label
 */
export const getRunningPRs = async (athleteId) => {
  if (!db) {
    throw new Error('Firebase is not initialized. Please check your Firebase configuration.');
  }

  try {
    await ensureAuthenticated();

    const activitiesRef = collection(db, 'athletes', athleteId, 'activities');
    const q = query(activitiesRef, orderBy('start_date', 'desc'));
    const querySnapshot = await getDocs(q);

    // Targets in meters and labels
    const targets = [
      { label: '400m', meters: 400 },
      { label: '1km', meters: 1000 },
      { label: '1 mile', meters: 1609.34 },
      { label: '5k', meters: 5000 },
      { label: '10k', meters: 10000 },
      { label: '15k', meters: 15000 },
      { label: 'Half Marathon', meters: 21097.5 },
      { label: 'Marathon', meters: 42195 },
    ];

    const results = {};
    // initialize
    targets.forEach((t) => {
      results[t.label] = { timeSeconds: null, activity: null, method: null };
    });

    let longest = { distance: 0, activity: null };

    querySnapshot.forEach((docSnap) => {
      const a = docSnap.data();
      const sport = a.sport_type || a.type || 'Unknown';
      if (sport.toLowerCase() !== 'run' && sport.toLowerCase() !== 'running') return;
      if (!a.distance || !a.moving_time) return;

      // longest
      if (a.distance > longest.distance) {
        longest = { distance: a.distance, activity: { id: a.id, name: a.name, start_date: a.start_date } };
      }

      // evaluate targets
      for (const t of targets) {
        const D = t.meters;
        const tol = D * 0.05; // 5% tolerance

        // exact match within tolerance
        if (Math.abs(a.distance - D) <= tol) {
          const candidateTime = a.moving_time;
          if (results[t.label].timeSeconds === null || candidateTime < results[t.label].timeSeconds) {
            results[t.label] = { timeSeconds: candidateTime, activity: { id: a.id, name: a.name, start_date: a.start_date, distance: a.distance }, method: 'exact' };
          }
          continue;
        }

        // estimate if activity longer than D
        if (a.distance >= D) {
          const estimated = a.moving_time * (D / a.distance);
          if (results[t.label].timeSeconds === null || estimated < results[t.label].timeSeconds) {
            results[t.label] = { timeSeconds: estimated, activity: { id: a.id, name: a.name, start_date: a.start_date, distance: a.distance }, method: 'estimate' };
          }
        }
      }
    });

    // attach longest
    results['Longest'] = { distance: longest.distance, activity: longest.activity };

    return results;
  } catch (error) {
    console.error('Error computing running PRs from Firebase:', error);
    throw error;
  }
};

/**
 * Compute cycling PRs for standard distances and elevation metrics.
 * Returns times for distance targets (using exact within 5% or estimated from longer rides),
 * longest ride, biggest climb (max elevation in single activity), and total elevation gain (sum).
 * @param {string} athleteId
 * @returns {Promise<Object>} PRs keyed by metric label
 */
export const getCyclingPRs = async (athleteId) => {
  if (!db) {
    throw new Error('Firebase is not initialized. Please check your Firebase configuration.');
  }

  try {
    await ensureAuthenticated();

    const activitiesRef = collection(db, 'athletes', athleteId, 'activities');
    const q = query(activitiesRef, orderBy('start_date', 'desc'));
    const querySnapshot = await getDocs(q);

    const targets = [
      { label: '5 mile', meters: 1609.34 * 5 },
      { label: '10K', meters: 10000 },
      { label: '10 mile', meters: 1609.34 * 10 },
      { label: '20K', meters: 20000 },
      { label: '30K', meters: 30000 },
      { label: '40K', meters: 40000 },
      { label: '50K', meters: 50000 },
      { label: '80K', meters: 80000 },
      { label: '50 mile', meters: 1609.34 * 50 },
      { label: '90K', meters: 90000 },
      { label: '100K', meters: 100000 },
      { label: '100 mile', meters: 1609.34 * 100 },
      { label: '180K', meters: 180000 },
    ];

    const results = {};
    targets.forEach((t) => {
      results[t.label] = { timeSeconds: null, activity: null, method: null };
    });

    let longest = { distance: 0, activity: null };
    let biggestClimb = { elevation: 0, activity: null };
    let totalElevationGain = 0;

    querySnapshot.forEach((docSnap) => {
      const a = docSnap.data();
      const sport = a.sport_type || a.type || 'Unknown';
      if (!sport) return;
      const sLower = sport.toLowerCase();
      if (sLower !== 'ride' && sLower !== 'cycling' && sLower !== 'ride') return;
      if (!a.distance || !a.moving_time) return;

      // longest
      if (a.distance > longest.distance) {
        longest = { distance: a.distance, activity: { id: a.id, name: a.name, start_date: a.start_date } };
      }

      // biggest climb (single activity elevation)
      const climb = a.total_elevation_gain || 0;
      totalElevationGain += climb;
      if (climb > biggestClimb.elevation) {
        biggestClimb = { elevation: climb, activity: { id: a.id, name: a.name, start_date: a.start_date } };
      }

      // distance PRs
      for (const t of targets) {
        const D = t.meters;
        const tol = D * 0.05;

        if (Math.abs(a.distance - D) <= tol) {
          const cand = a.moving_time;
          if (results[t.label].timeSeconds === null || cand < results[t.label].timeSeconds) {
            results[t.label] = { timeSeconds: cand, activity: { id: a.id, name: a.name, start_date: a.start_date, distance: a.distance }, method: 'exact' };
          }
          continue;
        }

        if (a.distance >= D) {
          const est = a.moving_time * (D / a.distance);
          if (results[t.label].timeSeconds === null || est < results[t.label].timeSeconds) {
            results[t.label] = { timeSeconds: est, activity: { id: a.id, name: a.name, start_date: a.start_date, distance: a.distance }, method: 'estimate' };
          }
        }
      }
    });

    results['Longest Ride'] = { distance: longest.distance, activity: longest.activity };
    results['Biggest Climb'] = { elevation: biggestClimb.elevation, activity: biggestClimb.activity };
    results['Elevation Gain'] = { total: totalElevationGain };

    return results;
  } catch (error) {
    console.error('Error computing cycling PRs from Firebase:', error);
    throw error;
  }
};

/**
 * Store athlete profile in Firebase
 * @param {string} athleteId - The Strava athlete ID
 * @param {Object} athleteProfile - Athlete profile object from Strava
 * @returns {Promise<Object>} Result object with success status
 */
export const storeAthleteProfile = async (athleteId, athleteProfile) => {
  if (!db) {
    throw new Error('Firebase is not initialized. Please check your Firebase configuration.');
  }

  try {
    await ensureAuthenticated();
    
    const athleteRef = doc(db, 'athletes', athleteId);
    
    const profileData = {
      ...athleteProfile,
      stored_at: Timestamp.now(),
      updated_at: Timestamp.now(),
    };

    await setDoc(athleteRef, { profile: profileData }, { merge: true });

    return {
      success: true,
      message: 'Athlete profile stored successfully',
    };
  } catch (error) {
    console.error('Error storing athlete profile in Firebase:', error);
    throw error;
  }
};

/**
 * Get athlete profile from Firebase
 * @param {string} athleteId - The Strava athlete ID
 * @returns {Promise<Object|null>} Athlete profile object or null
 */
export const getAthleteProfile = async (athleteId) => {
  if (!db) {
    throw new Error('Firebase is not initialized. Please check your Firebase configuration.');
  }

  try {
    await ensureAuthenticated();
    
    const athleteRef = doc(db, 'athletes', athleteId);
    const docSnap = await getDoc(athleteRef);

    if (docSnap.exists()) {
      const data = docSnap.data();
      return data.profile || null;
    }

    return null;
  } catch (error) {
    console.error('Error fetching athlete profile from Firebase:', error);
    throw error;
  }
};

/**
 * Store athlete stats in Firebase
 * @param {string} athleteId - The Strava athlete ID
 * @param {Object} athleteStats - Athlete stats object from Strava
 * @returns {Promise<Object>} Result object with success status
 */
export const storeAthleteStats = async (athleteId, athleteStats) => {
  if (!db) {
    throw new Error('Firebase is not initialized. Please check your Firebase configuration.');
  }

  try {
    await ensureAuthenticated();
    
    const athleteRef = doc(db, 'athletes', athleteId);
    
    const statsData = {
      ...athleteStats,
      stored_at: Timestamp.now(),
      updated_at: Timestamp.now(),
    };

    await setDoc(athleteRef, { stats: statsData }, { merge: true });

    return {
      success: true,
      message: 'Athlete stats stored successfully',
    };
  } catch (error) {
    console.error('Error storing athlete stats in Firebase:', error);
    throw error;
  }
};

/**
 * Get athlete stats from Firebase
 * @param {string} athleteId - The Strava athlete ID
 * @returns {Promise<Object|null>} Athlete stats object or null
 */
export const getAthleteStats = async (athleteId) => {
  if (!db) {
    throw new Error('Firebase is not initialized. Please check your Firebase configuration.');
  }

  try {
    await ensureAuthenticated();
    
    const athleteRef = doc(db, 'athletes', athleteId);
    const docSnap = await getDoc(athleteRef);

    if (docSnap.exists()) {
      const data = docSnap.data();
      return data.stats || null;
    }

    return null;
  } catch (error) {
    console.error('Error fetching athlete stats from Firebase:', error);
    throw error;
  }
};

/**
 * Store sync status in Firebase
 * @param {string} athleteId - The Strava athlete ID
 * @param {Object} syncStatus - Sync status object
 * @returns {Promise<Object>} Result object with success status
 */
export const storeSyncStatus = async (athleteId, syncStatus) => {
  if (!db) {
    throw new Error('Firebase is not initialized. Please check your Firebase configuration.');
  }

  try {
    await ensureAuthenticated();
    
    const athleteRef = doc(db, 'athletes', athleteId);
    
    const statusData = {
      ...syncStatus,
      stored_at: Timestamp.now(),
    };

    await setDoc(athleteRef, { syncStatus: statusData }, { merge: true });

    return {
      success: true,
      message: 'Sync status stored successfully',
    };
  } catch (error) {
    console.error('Error storing sync status in Firebase:', error);
    throw error;
  }
};

/**
 * Get sync status from Firebase
 * @param {string} athleteId - The Strava athlete ID
 * @returns {Promise<Object|null>} Sync status object or null
 */
export const getSyncStatus = async (athleteId) => {
  if (!db) {
    throw new Error('Firebase is not initialized. Please check your Firebase configuration.');
  }

  try {
    await ensureAuthenticated();
    
    const athleteRef = doc(db, 'athletes', athleteId);
    const docSnap = await getDoc(athleteRef);

    if (docSnap.exists()) {
      const data = docSnap.data();
      return data.syncStatus || null;
    }

    return null;
  } catch (error) {
    console.error('Error fetching sync status from Firebase:', error);
    throw error;
  }
};
