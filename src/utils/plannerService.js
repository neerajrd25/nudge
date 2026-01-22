import { 
  collection, 
  doc, 
  setDoc, 
  getDocs, 
  query, 
  where,
  orderBy,
  Timestamp,
  updateDoc,
  addDoc,
  deleteDoc,
  deleteField
} from 'firebase/firestore';
import { db, ensureAuthenticated } from './firebaseConfig';

/**
 * Get planned workouts for a user within a date range
 * @param {string} athleteId 
 * @param {Date} startDate 
 * @param {Date} endDate 
 */
export const getPlannedWorkouts = async (athleteId, startDate, endDate) => {
  if (!db) throw new Error('Firebase is not initialized.');
  try {
    await ensureAuthenticated();
    const plannedRef = collection(db, 'athletes', String(athleteId), 'planned_workouts');
    const formatDate = (date) => {
      const d = new Date(date);
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    const q = query(
      plannedRef,
      where('date', '>=', formatDate(startDate)),
      where('date', '<=', formatDate(endDate)),
      orderBy('date', 'asc')
    );

    const snapshot = await getDocs(q);
    const workouts = [];
    snapshot.forEach(doc => {
      workouts.push({ id: doc.id, ...doc.data() });
    });
    return workouts;
  } catch (error) {
    console.error('Error fetching planned workouts:', error);
    throw error;
  }
};

/**
 * Save or update a planned workout
 * @param {string} athleteId 
 * @param {Object} workout 
 */
export const savePlannedWorkout = async (athleteId, workout) => {
  if (!db) throw new Error('Firebase is not initialized.');
  try {
    await ensureAuthenticated();
    const plannedRef = collection(db, 'athletes', String(athleteId), 'planned_workouts');
    
    const workoutData = {
      ...workout,
      plannedDuration: parseInt(workout.plannedDuration || 0),
      status: workout.status || 'pending',
      updated_at: Timestamp.now(),
    };

    if (workout.id) {
      const docRef = doc(db, 'athletes', String(athleteId), 'planned_workouts', workout.id);
      
      // For updates, we explicitly handle field removal if they are empty
      const updateData = { ...workoutData };
      delete updateData.id; // Don't include ID in update payload
      
      if (!workout.raceType) updateData.raceType = deleteField();
      if (!workout.details) updateData.details = deleteField();
      if (!workout.focus) updateData.focus = deleteField();
      if (workout.plannedDistance === null || workout.plannedDistance === undefined || workout.plannedDistance === '') updateData.plannedDistance = deleteField();
      if (workout.completionSource === undefined) updateData.completionSource = deleteField();
      if (workout.actualActivity === undefined) updateData.actualActivity = deleteField();
      if (workout.actualDuration === undefined) updateData.actualDuration = deleteField();

      await updateDoc(docRef, updateData);
      return { id: workout.id, success: true };
    } else {
      const docData = {
        ...workoutData,
        created_at: Timestamp.now(),
      };
      const docRef = await addDoc(plannedRef, docData);
      return { id: docRef.id, success: true };
    }
  } catch (error) {
    console.error('Error saving planned workout:', error);
    throw error;
  }
};

/**
 * Delete a planned workout
 * @param {string} athleteId 
 * @param {string} workoutId 
 */
export const deletePlannedWorkout = async (athleteId, workoutId) => {
  if (!db) throw new Error('Firebase is not initialized.');
  try {
    await ensureAuthenticated();
    const docRef = doc(db, 'athletes', String(athleteId), 'planned_workouts', workoutId);
    await deleteDoc(docRef);
    return { success: true };
  } catch (error) {
    console.error('Error deleting planned workout:', error);
    throw error;
  }
};

/**
 * Bulk import planned workouts
 * @param {string} athleteId 
 * @param {Array} workouts 
 */
export const importPlannedWorkouts = async (athleteId, workouts) => {
  if (!db) throw new Error('Firebase is not initialized.');
  try {
    await ensureAuthenticated();
    // Use individual saves for simplicity since Firebase batching has limits 
    // and we want to reuse savePlannedWorkout logic
    const results = [];
    for (const workout of workouts) {
      const res = await savePlannedWorkout(athleteId, workout);
      results.push(res);
    }
    return { success: true, count: results.length };
  } catch (error) {
    console.error('Error importing planned workouts:', error);
    throw error;
  }
};

/**
 * Check if an activity matches a planned workout based on type, distance, and duration
 * @param {Object} activity - Strava activity
 * @param {Object} plannedWorkout - Planned workout
 * @param {Object} tolerances - Tolerance percentages for matching
 * @returns {boolean} - Whether the activity matches the planned workout
 */
const isActivityMatch = (activity, plannedWorkout, tolerances = { distance: 0.30, duration: 0.50 }) => {
  console.log(`\n🔍 MATCHING: "${activity.name}" vs Planned "${plannedWorkout.plannedActivity}"`);
  
  const activityType = (activity.type || activity.sport_type || '').toLowerCase();
  const plannedType = (plannedWorkout.plannedActivity || '').toLowerCase();
  
  console.log(`  📋 Raw Types: Activity="${activityType}" | Planned="${plannedType}"`);
  
  // Type matching: normalize common types
  const normalize = (t) => {
    const s = t.toLowerCase();
    if (s.includes('run')) return 'run';
    if (s.includes('ride') || s.includes('cycle') || s.includes('bike')) return 'cycle';
    if (s.includes('swim')) return 'swim';
    if (s.includes('strength') || s.includes('weight') || s.includes('barbell') || s.includes('gym') || s.includes('workout')) return 'strength';
    if (s.includes('yoga') || s.includes('mobility')) return 'mobility';
    return s.replace('virtual', '').trim();
  };

  const normAct = normalize(activityType);
  const normPlan = normalize(plannedType);
  
  console.log(`  🏷️  Normalized Types: Activity="${normAct}" | Planned="${normPlan}"`);
  
  const typeMatch = normPlan.includes(normAct) || normAct.includes(normPlan);
  console.log(`  ✅ Type Match: ${typeMatch}`);
  
  if (!typeMatch) {
    console.log(`  ❌ FAILED: Type mismatch\n`);
    return false;
  }
  
  // Distance matching with 30% tolerance (primary criteria)
  let hasDistanceData = false;
  if (activity.distance && plannedWorkout.plannedDistance) {
    hasDistanceData = true;
    const activityDistanceKm = activity.distance / 1000;
    const plannedDistanceKm = parseFloat(plannedWorkout.plannedDistance);
    console.log(`  📏 Distance Data Found: Activity=${activityDistanceKm.toFixed(2)}km | Planned=${plannedDistanceKm}km`);
    
    if (!isNaN(plannedDistanceKm) && plannedDistanceKm > 0) {
      const distanceDiff = Math.abs(activityDistanceKm - plannedDistanceKm);
      const distanceTolerance = plannedDistanceKm * tolerances.distance;
      const isMatch = distanceDiff <= distanceTolerance;
      const diffPercent = ((distanceDiff / plannedDistanceKm) * 100).toFixed(1);
      console.log(`     Difference: ${distanceDiff.toFixed(2)}km (${diffPercent}%)`);
      console.log(`     Tolerance: ${distanceTolerance.toFixed(2)}km (${(tolerances.distance * 100).toFixed(0)}%)`);
      console.log(`     ${isMatch ? '✅' : '❌'} Distance Match: ${isMatch}`);
      
      if (!isMatch) {
        console.log(`  ❌ FAILED: Distance outside tolerance\n`);
        return false;
      }
    }
  } else {
    console.log(`  📏 Distance Data: ${activity.distance ? 'Activity has' : 'Activity missing'} | ${plannedWorkout.plannedDistance ? 'Planned has' : 'Planned missing'}`);
  }
  
  // Duration matching with 50% tolerance (secondary criteria, more lenient)
  // Only enforce if no distance data available
  if (!hasDistanceData && activity.moving_time && plannedWorkout.plannedDuration) {
    console.log(`  ⏱️  No distance data - checking duration...`);
    const activityDurationMin = Math.round(activity.moving_time / 60);
    const plannedDurationMin = parseInt(plannedWorkout.plannedDuration);
    console.log(`     Duration Data: Activity=${activityDurationMin}min | Planned=${plannedDurationMin}min`);
    
    if (!isNaN(plannedDurationMin) && plannedDurationMin > 0) {
      const durationDiff = Math.abs(activityDurationMin - plannedDurationMin);
      const durationTolerance = plannedDurationMin * tolerances.duration;
      const isMatch = durationDiff <= durationTolerance;
      const diffPercent = ((durationDiff / plannedDurationMin) * 100).toFixed(1);
      console.log(`     Difference: ${durationDiff}min (${diffPercent}%)`);
      console.log(`     Tolerance: ${durationTolerance.toFixed(1)}min (${(tolerances.duration * 100).toFixed(0)}%)`);
      console.log(`     ${isMatch ? '✅' : '❌'} Duration Match: ${isMatch}`);
      
      if (!isMatch) {
        console.log(`  ❌ FAILED: Duration outside tolerance\n`);
        return false;
      }
    }
  } else if (hasDistanceData) {
    console.log(`  ⏱️  Duration check skipped (distance data available)`);
  } else {
    console.log(`  ⏱️  Duration Data: ${activity.moving_time ? 'Activity has' : 'Activity missing'} | ${plannedWorkout.plannedDuration ? 'Planned has' : 'Planned missing'}`);
  }
  
  console.log(`  ✅ SUCCESS: Full match!\n`);
  return true;
};

/**
 * Automatically match Strava activities to planned workouts
 * 
 * Logic:
 * 1. Find planned workouts for the dates of the activities.
 * 2. Match based on date, type, distance (20% tolerance), and duration (25% tolerance).
 * 
 * @param {string} athleteId 
 * @param {Array} activities - Strava activities 
 */
export const autoMatchActivities = async (athleteId, activities) => {
  if (!activities || activities.length === 0) return { matched: [], potential: [] };
  const results = { matched: [], potential: [] };

  try {
    const validActivities = activities.filter(a => a.start_date_local || a.start_date);
    if (validActivities.length === 0) return results;

    const dates = validActivities.map(a => new Date(a.start_date_local || a.start_date));
    const minDate = new Date(Math.min(...dates));
    const maxDate = new Date(Math.max(...dates));
    
    console.log(`Searching for workouts between ${minDate.toISOString()} and ${maxDate.toISOString()}`);
    const plannedWorkouts = await getPlannedWorkouts(athleteId, minDate, maxDate);
    console.log(`Found ${plannedWorkouts.length} planned workouts for the period`);
    
    // Build a set of already-matched activity IDs to skip re-processing
    const alreadyMatchedActivityIds = new Set(
      plannedWorkouts
        .filter(p => p.stravaActivityId)
        .map(p => p.stravaActivityId)
    );
    
    const unmatchedActivities = validActivities.filter(a => {
      const isAlreadyMatched = alreadyMatchedActivityIds.has(a.id);
      if (isAlreadyMatched) {
        console.log(`Skipping activity ${a.id} "${a.name}" - already matched to a workout`);
      }
      return !isAlreadyMatched;
    });
    
    console.log(`Processing ${unmatchedActivities.length} unmatched activities out of ${validActivities.length} total`);
    
    for (const activity of unmatchedActivities) {
      const activityDate = (activity.start_date_local || activity.start_date).split('T')[0];
      console.log(`Processing activity: ${activity.name}, Date: ${activityDate}, Type: ${activity.type}`);

      // 1. Try strict auto-match
      const match = plannedWorkouts.find(p => {
        if (p.date !== activityDate) {
          console.log(`  Skipping workout ${p.id} due to date mismatch: activity date ${activityDate} vs workout date ${p.date}`);
          return false;
        }
        
        // Allow matching even if 'done' IF it's not already linked to a Strava session
        if (p.stravaActivityId) {
          console.log(`  Skipping workout ${p.id} because it is already linked to Strava activity ${p.stravaActivityId}`);
          return false;
        }
        
        const isMatch = isActivityMatch(activity, p);
        console.log(`  Match check for "${p.plannedActivity}" (Status: ${p.status}) vs "${activity.name}": ${isMatch}`);
        return isMatch;
      });

      if (match) {
        console.log(`  Strict match FOUND for workout: ${match.id}`);
        const docRef = doc(db, 'athletes', String(athleteId), 'planned_workouts', match.id);
        const update = {
          status: 'done',
          actualActivity: activity.name,
          actualDuration: Math.round(activity.moving_time / 60),
          actualDistance: activity.distance ? (activity.distance / 1000).toFixed(2) : 0,
          stravaActivityId: activity.id,
          actualTss: activity.tss || 0,
          completionSource: 'auto',
          updated_at: Timestamp.now(),
        };
        await updateDoc(docRef, update);
        results.matched.push({ activity, workout: { ...match, ...update } });
        // Mark match as 'done' locally in our list so we don't match it again in this loop
        match.status = 'done';
      } else {
        // 2. Check for potential matches on the same day (anything not already linked)
        const sameDayPending = plannedWorkouts.filter(p => p.date === activityDate && !p.stravaActivityId);
        console.log(`  No strict match. Found ${sameDayPending.length} same-day candidates for potential matching review.`);
        if (sameDayPending.length > 0) {
          results.potential.push({ activity, potentialWorkouts: sameDayPending });
        }
      }
    }
    return results;
  } catch (error) {
    console.error('Error in auto-matching:', error);
    return results;
  }
};

/**
 * Manually link a Strava activity to a planned workout
 */
export const manualLinkActivityToWorkout = async (athleteId, workoutId, activity) => {
  if (!db) throw new Error('Firebase is not initialized.');
  try {
    await ensureAuthenticated();
    const docRef = doc(db, 'athletes', String(athleteId), 'planned_workouts', workoutId);
    await updateDoc(docRef, {
      status: 'done',
      actualActivity: activity.name,
      actualDuration: Math.round(activity.moving_time / 60),
      actualDistance: activity.distance ? (activity.distance / 1000).toFixed(2) : 0,
      stravaActivityId: activity.id,
      actualTss: activity.tss || 0,
      completionSource: 'manual',
      updated_at: Timestamp.now(),
    });
    return { success: true };
  } catch (error) {
    console.error('Error manually linking activity:', error);
    throw error;
  }
};

/**
 * Unlink a Strava activity from a planned workout
 */
export const unlinkActivityFromWorkout = async (athleteId, workoutId) => {
  if (!db) throw new Error('Firebase is not initialized.');
  try {
    await ensureAuthenticated();
    const docRef = doc(db, 'athletes', String(athleteId), 'planned_workouts', workoutId);
    await updateDoc(docRef, {
      status: 'pending',
      actualActivity: deleteField(),
      actualDuration: deleteField(),
      actualDistance: deleteField(),
      stravaActivityId: deleteField(),
      actualTss: deleteField(),
      updated_at: Timestamp.now(),
    });
    return { success: true };
  } catch (error) {
    console.error('Error unlinking activity:', error);
    throw error;
  }
};
