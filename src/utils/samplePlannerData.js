/**
 * Sample CSV data for testing the Planner component
 * This file provides example data in the correct format
 */

export const samplePlannerData = `date,plannedActivity,plannedDuration,actualActivity,actualDuration,status
2026-01-04,Run - 10km Easy (9:00 pace),60,Run - 10km Easy,58,done
2026-01-05,Rest/Mobility - Foot Rehab,20,Mobility Session,25,done
2026-01-06,Run - 6km Easy (8:45 pace),36,,,pending
2026-01-07,Strength/Spin - 30m Spin + Squats,60,,,pending
2026-01-08,Run - 8km Easy (8:40 pace),48,,,pending
2026-01-09,Mobility/Rehab - Calf holds,20,,,pending
2026-01-10,Cycle - 50km Mountain Rolling,120,Cycle - 50km,115,done
2026-01-11,Run - 12km Very Easy (9:15 pace),70,,,pending
2026-01-12,Rest/Mobility - Foot Rehab,20,,,pending
2026-01-13,Run - 6km (Include 4x400m strides),40,,,pending
2026-01-14,Strength/Spin - 45m Spin,45,,,pending
2026-01-15,Run - 10km Steady (8:30 pace),55,Run - 10km Steady,60,done
2026-01-16,Mobility/Rehab - Tibialis Raises,20,,,missed
2026-01-17,Cycle - 50km Steep Climbing,130,Cycle - 45km,110,done
2026-01-18,Run - 14km Slow (9:15 pace),80,,,pending
2026-01-19,Rest/Mobility - Foot Rehab,20,,,pending
2026-01-20,Run - 5km Very Easy,30,,,pending`;

export const emptyPlannerData = `date,plannedActivity,plannedDuration,actualActivity,actualDuration,status`;

/**
 * Generate sample data for a month
 * @param {number} year
 * @param {number} month - 1-12
 * @param {number} numActivities - Number of activities to generate
 */
export function generateSampleMonth(year = 2026, month = 1, numActivities = 20) {
  const activities = [
    { name: 'Run - Easy', duration: 45 },
    { name: 'Run - Tempo', duration: 60 },
    { name: 'Cycle - Endurance', duration: 120 },
    { name: 'Strength Training', duration: 45 },
    { name: 'Mobility/Yoga', duration: 30 },
    { name: 'Rest', duration: 0 },
  ];

  const statuses = ['pending', 'done', 'missed'];
  const rows = ['date,plannedActivity,plannedDuration,actualActivity,actualDuration,status'];

  for (let i = 0; i < numActivities; i++) {
    const day = Math.floor(Math.random() * 28) + 1;
    const date = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    
    const activity = activities[Math.floor(Math.random() * activities.length)];
    const status = statuses[Math.floor(Math.random() * statuses.length)];
    
    let actualActivity = '';
    let actualDuration = '';
    
    if (status === 'done') {
      actualActivity = activity.name;
      actualDuration = activity.duration + Math.floor(Math.random() * 20 - 10); // +/- 10 min variance
    }

    rows.push(
      `${date},${activity.name},${activity.duration},${actualActivity},${actualDuration},${status}`
    );
  }

  return rows.join('\n');
}
