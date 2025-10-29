import { 
  collection, 
  doc, 
  setDoc, 
  getDocs, 
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
