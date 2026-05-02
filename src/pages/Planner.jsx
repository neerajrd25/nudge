import { useState, useMemo, useEffect } from 'react';
import { useViewportSize } from '@mantine/hooks';
import {
  Container,
  Stack,
  Group,
  Title,
  Text,
  Button,
  Select,
  TextInput,
  Textarea,
  NumberInput,
  Modal,
  Box,
  Paper,
  SimpleGrid,
  Badge,
  rem,
  Divider,
  SegmentedControl,
  Center,
} from '@mantine/core';
import { getPlannedWorkouts, savePlannedWorkout, importPlannedWorkouts, deletePlannedWorkout, unlinkActivityFromWorkout } from '../utils/plannerService';
import { getActivitiesByDateRange } from '../utils/firebaseService';
import { IconUpload, IconTrash, IconArrowsMove, IconRun, IconBike, IconBarbell, IconYoga, IconPool, IconMoon, IconBrandStrava, IconCalendar, IconUnlink, IconCopy, IconCheck } from '@tabler/icons-react';
import { getStoredAuthData, getAthleteActivities, isTokenExpired, refreshAccessToken, storeAuthData } from '../utils/stravaApi';
import { calculateTSS, getActivityType, estimatePlannedTSS } from '../utils/metrics';

const ACTIVITY_CONFIG = {
  run: { color: 'red.7', icon: <IconRun size={14} /> },
  cycle: { color: 'blue.7', icon: <IconBike size={14} /> },
  swim: { color: 'cyan.7', icon: <IconPool size={14} /> },
  strength: { color: 'violet.7', icon: <IconBarbell size={14} /> },
  mobility: { color: 'teal.7', icon: <IconYoga size={14} /> },
  rest: { color: 'gray.7', icon: <IconMoon size={14} /> },
  workout: { color: 'indigo.7', icon: <IconBarbell size={14} /> },
};

function groupByDate(items) {
  return items.reduce((acc, item) => {
    if (!acc[item.date]) acc[item.date] = [];
    acc[item.date].push(item);
    return acc;
  }, {});
}

function parseCsvRows(csvText) {
  const rows = [];
  let currentRow = [];
  let currentCell = '';
  let inQuotes = false;

  for (let i = 0; i < csvText.length; i++) {
    const char = csvText[i];
    const nextChar = csvText[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        currentCell += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === ',' && !inQuotes) {
      currentRow.push(currentCell);
      currentCell = '';
      continue;
    }

    if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && nextChar === '\n') i++;
      currentRow.push(currentCell);
      const hasContent = currentRow.some(cell => String(cell).trim() !== '');
      if (hasContent) rows.push(currentRow);
      currentRow = [];
      currentCell = '';
      continue;
    }

    currentCell += char;
  }

  if (currentCell.length > 0 || currentRow.length > 0) {
    currentRow.push(currentCell);
    const hasContent = currentRow.some(cell => String(cell).trim() !== '');
    if (hasContent) rows.push(currentRow);
  }

  return rows;
}

function normalizeHeader(header) {
  return String(header || '')
    .toLowerCase()
    .replace(/[\/_-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseNumericCell(value) {
  if (value === undefined || value === null) return null;
  const matched = String(value).trim().match(/-?\d+(?:\.\d+)?/);
  if (!matched) return null;
  const parsed = Number(matched[0]);
  return Number.isFinite(parsed) ? parsed : null;
}


function getStatusColor(status, raceType, item) {
  if (status === 'done') return 'green.7';
  if (status === 'missed') return 'red.8';
  return null;
}

function formatDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getWeeksInMonth(date) {
  const year = date.getFullYear();
  const month = date.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const weeks = [];
  let currentWeek = [];
  const startDayOfWeek = firstDay.getDay();

  // Adjust for Monday start (getDay() returns 0 for Sunday, 1 for Monday, etc.)
  // If first day is Sunday (0), we need 6 padding days. If Monday (1), 0 padding, etc.
  const paddingDays = startDayOfWeek === 0 ? 6 : startDayOfWeek - 1;
  for (let i = 0; i < paddingDays; i++) currentWeek.push(null);

  for (let day = 1; day <= lastDay.getDate(); day++) {
    const currentDate = new Date(year, month, day);
    currentWeek.push(currentDate);
    if (currentDate.getDay() === 0) { // Sunday is the end of the week
      weeks.push(currentWeek);
      currentWeek = [];
    }
  }
  if (currentWeek.length > 0) {
    while (currentWeek.length < 7) currentWeek.push(null);
    weeks.push(currentWeek);
  }
  return weeks;
}

function getWeekTotals(week, itemsByDate) {
  let plannedMinutes = 0, actualMinutes = 0, completed = 0, total = 0, plannedTSS = 0, actualTSS = 0;

  // Track Strava IDs to prevent double counting in TSS/Duration
  const processedStravaIds = new Set();
  const processedPlannedWorkouts = new Set();

  week.forEach(day => {
    if (!day) return;
    const items = itemsByDate[formatDateKey(day)] || [];

    items.forEach(item => {
      // 1. Logic for Actual Activities (from Strava)
      if (item.isActual) {
        const stravaId = item.id.replace('strava-', '');
        if (!processedStravaIds.has(stravaId)) {
          actualMinutes += item.actualDuration || 0;
          actualTSS += item.tss || calculateTSS(item, null) || 0;
          processedStravaIds.add(stravaId);
        }
        return;
      }

      // 2. Logic for Planned Workouts
      total++;
      plannedMinutes += item.plannedDuration || 0;

      const estTSS = estimatePlannedTSS(item);
      plannedTSS += estTSS;

      if (item.status === 'done') {
        completed++;
        // If it's linked to an actual Strava activity, we skip its contribution to "actualTSS" 
        // here because it's already accounted for in the isActual check above (to prevent double counting)
        if (!item.stravaActivityId) {
          actualMinutes += item.actualDuration || item.plannedDuration || 0;
          actualTSS += item.actualTss || estTSS;
        }
      }
    });
  });
  return { plannedMinutes, actualMinutes, completed, total, plannedTSS, actualTSS };
}

const Planner = ({ initialDate = new Date() }) => {
  const [selectedDate, setSelectedDate] = useState(null);
  const [currentMonth, setCurrentMonth] = useState(initialDate);
  const [plannerItems, setPlannerItems] = useState([]);
  const [actualActivities, setActualActivities] = useState([]);
  const [rawStravaData, setRawStravaData] = useState([]);
  const [viewMode, setViewMode] = useState('all'); // 'planned', 'actual', 'all'
  const { width } = useViewportSize();
  const isMobile = width > 0 && width < 768;
  const [loading, setLoading] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newWorkout, setNewWorkout] = useState({
    plannedActivity: '',
    plannedDuration: 30,
    plannedDistance: '',
    date: formatDateKey(new Date()),
    details: '',
    focus: '',
    raceType: '',
    activityType: 'run',
    plannedTss: '',
  });

  const authData = getStoredAuthData();
  const athleteId = authData?.athlete?.id ? String(authData.athlete.id) : null;

  useEffect(() => {
    if (!athleteId) return;
    const fetchData = async () => {
      setLoading(true);
      try {
        const startOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
        const endOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0);

        // Fetch with a buffer to handle weeks crossing month boundaries
        const fetchStart = new Date(startOfMonth);
        fetchStart.setDate(fetchStart.getDate() - 7);
        const fetchEnd = new Date(endOfMonth);
        fetchEnd.setDate(fetchEnd.getDate() + 7);

        // Fetch Planned
        const planned = await getPlannedWorkouts(athleteId, fetchStart, fetchEnd);
        setPlannerItems(planned);

        // Fetch Actual from Firebase
        const strava = await getActivitiesByDateRange(athleteId, fetchStart, fetchEnd);
        setRawStravaData(strava); // Store raw data for CSV export
        const transformed = strava.map(act => ({
          id: `strava-${act.id}`,
          plannedActivity: act.name,
          plannedDuration: Math.round((act.moving_time || 0) / 60),
          actualDuration: Math.round((act.moving_time || 0) / 60),
          date: (act.start_date_local || act.start_date).split('T')[0],
          details: `${((act.distance || 0) / 1000).toFixed(2)}km • ${act.type}`,
          status: 'done',
          isActual: true,
          activityType: (act.sport_type || act.type || '').toLowerCase(),
          tss: act.tss, // Include TSS from Strava
        }));
        setActualActivities(transformed);
      } catch (error) { console.error(error); }
      finally { setLoading(false); }
    };
    fetchData();
  }, [athleteId, currentMonth, authData?.accessToken]);

  const itemsByDate = useMemo(() => {
    let combined = [];
    if (viewMode === 'planned' || viewMode === 'all') combined = [...combined, ...plannerItems];
    if (viewMode === 'actual' || viewMode === 'all') combined = [...combined, ...actualActivities];
    return groupByDate(combined);
  }, [plannerItems, actualActivities, viewMode]);
  const weeks = useMemo(() => getWeeksInMonth(currentMonth), [currentMonth]);

  const handlePrevMonth = () => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
  const handleNextMonth = () => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
  const handleToday = () => setCurrentMonth(new Date());

  const getWeekNumber = (date) => {
    const firstDayOfYear = new Date(date.getFullYear(), 0, 1);
    const pastDaysOfYear = (date - firstDayOfYear) / 86400000;
    return Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
  };

  const getWeekRange = (date) => {
    const curr = new Date(date);
    const firstDay = curr.getDate() - curr.getDay() + 1; // Monday
    const lastDay = firstDay + 6; // Sunday
    
    const monday = new Date(curr.setDate(firstDay));
    monday.setHours(0, 0, 0, 0);
    
    const sunday = new Date(curr);
    sunday.setDate(lastDay);
    sunday.setHours(23, 59, 59, 999);
    
    return { start: monday, end: sunday };
  };

  const copyWeeklyData = async (week, weekIndex) => {
    try {
      // Get valid days from the week array (filter out null values)
      const validDays = week.filter(day => day !== null);
      if (validDays.length === 0) return;
      
      // Create date strings for all days in this week for matching
      const weekDateKeys = validDays.map(day => formatDateKey(day));
      const firstValidDay = validDays[0];
      const weekNumber = getWeekNumber(firstValidDay);
      
      // Filter activities for the selected week - only actual Strava activities
      // Match by checking if the activity date matches any date in this week
      const weekActivities = rawStravaData.filter(act => {
        const actDate = new Date(act.start_date_local || act.start_date);
        const actDateKey = formatDateKey(actDate);
        return weekDateKeys.includes(actDateKey);
      });

      // Debug: Log first cycling activity to see available power fields
      const cyclingActivity = weekActivities.find(act => 
        act.type === 'Ride' || act.type === 'VirtualRide' || 
        act.sport_type === 'Ride' || act.sport_type === 'VirtualRide'
      );
      if (cyclingActivity) {
        console.log('Cycling activity power fields:', {
          average_watts: cyclingActivity.average_watts,
          weighted_average_watts: cyclingActivity.weighted_average_watts,
          device_watts: cyclingActivity.device_watts,
          has_heartrate: !!cyclingActivity.has_heartrate,
          all_keys: Object.keys(cyclingActivity).filter(k => k.includes('watt') || k.includes('power'))
        });
      }

      // Sort by date
      weekActivities.sort((a, b) => {
        const dateA = new Date(a.start_date_local || a.start_date);
        const dateB = new Date(b.start_date_local || b.start_date);
        return dateA - dateB;
      });

      // Generate CSV
      const headers = 'Week,Date,Day,Activity Type,Duration,Avg HR,Avg Pace,Avg Cadence,Avg Speed(If Cycling),Avg Power(If Cycling),Elevation Gain(m)';
      const rows = weekActivities.map(act => {
        const actDate = new Date(act.start_date_local || act.start_date);
        const date = actDate.toISOString().split('T')[0];
        const day = actDate.toLocaleDateString('en-US', { weekday: 'long' });
        const durationMinutes = Math.floor((act.moving_time || 0) / 60);
        const durationSeconds = (act.moving_time || 0) % 60;
        const duration = `${durationMinutes}:${String(durationSeconds).padStart(2, '0')}`;
        
        // Calculate pace (min/km) for running/walking
        const isRunWalk = (act.type === 'Run' || act.type === 'Walk' || act.sport_type === 'Run' || act.sport_type === 'Walk');
        const pace = isRunWalk && act.distance > 0
          ? (() => {
              const paceMinPerKm = (act.moving_time / 60) / (act.distance / 1000);
              const paceMin = Math.floor(paceMinPerKm);
              const paceSec = Math.round((paceMinPerKm % 1) * 60);
              return `${paceMin}:${String(paceSec).padStart(2, '0')}`;
            })()
          : '';
        
        // Speed for cycling (km/h) - includes both outdoor and virtual rides
        const isCycling = (act.type === 'Ride' || act.type === 'VirtualRide' || act.sport_type === 'Ride' || act.sport_type === 'VirtualRide');
        const speed = isCycling && act.average_speed
          ? (act.average_speed * 3.6).toFixed(2)
          : '';
        
        // Power for cycling (watts) - check multiple possible fields
        const power = isCycling && (act.weighted_average_watts || act.average_watts || act.device_watts)
          ? Math.round(act.weighted_average_watts || act.average_watts || act.device_watts)
          : '';
        
        const avgHr = act.average_heartrate ? Math.round(act.average_heartrate) : '';
        const avgCadence = act.average_cadence ? Math.round(act.average_cadence * (isCycling ? 2 : 1)) : '';
        
        // Elevation gain in meters
        const elevation = act.total_elevation_gain ? Math.round(act.total_elevation_gain) : '';
        
        return `${weekNumber},${date},${day},${act.type || act.sport_type},${duration},${avgHr},${pace},${avgCadence},${speed},${power},${elevation}`;
      });

      const csvContent = [headers, ...rows].join('\n');
      
      await navigator.clipboard.writeText(csvContent);
      alert(`Week ${weekNumber} data copied to clipboard! (${weekActivities.length} activities)`);
    } catch (err) {
      console.error('Failed to copy:', err);
      alert('Failed to copy data to clipboard');
    }
  };

  const handleAddWorkout = async () => {
    if (!athleteId || !newWorkout.plannedActivity || !newWorkout.date) return;
    try {
      const workoutToSave = {
        ...newWorkout,
        status: newWorkout.status || 'pending',
      };
      // Ensure optional fields are handled
      if (!workoutToSave.raceType) delete workoutToSave.raceType;

      const result = await savePlannedWorkout(athleteId, workoutToSave);
      if (result.success) {
        const items = await getPlannedWorkouts(athleteId,
          new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1),
          new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0)
        );
        setPlannerItems(items);
        setShowAddForm(false);
        setNewWorkout({
          plannedActivity: '',
          plannedDuration: 30,
          plannedDistance: '',
          date: formatDateKey(new Date()),
          details: '',
          focus: '',
          raceType: '',
          activityType: 'run',
          plannedTss: ''
        });
      }
    } catch (e) { console.error(e); }
  };

  const handleDeleteWorkout = async (workoutId) => {
    if (!athleteId || !workoutId) return;
    try {
      await deletePlannedWorkout(athleteId, workoutId);
      const items = await getPlannedWorkouts(athleteId,
        new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1),
        new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0)
      );
      setPlannerItems(items);
      setSelectedDate(null);
    } catch (e) { console.error(e); }
  };

  const [draggedItem, setDraggedItem] = useState(null);

  const handleDragStart = (e, item) => {
    setDraggedItem(item);
    e.dataTransfer.effectAllowed = 'move';
    // Visual feedback
    e.currentTarget.style.opacity = '0.4';
  };

  const handleDragEnd = (e) => {
    e.currentTarget.style.opacity = '1';
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = async (e, targetDate) => {
    e.preventDefault();
    if (!draggedItem || !targetDate) return;

    const newDate = formatDateKey(targetDate);
    if (newDate === draggedItem.date) return;

    try {
      setLoading(true);
      await savePlannedWorkout(athleteId, {
        ...draggedItem,
        date: newDate
      });
      const items = await getPlannedWorkouts(athleteId,
        new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1),
        new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0)
      );
      setPlannerItems(items);
      setDraggedItem(null);
    } catch (error) {
      console.error('Failed to move workout:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleEditClick = (item) => {
    setNewWorkout({
      id: item.id,
      plannedActivity: item.plannedActivity || '',
      plannedDuration: item.plannedDuration || 30,
      plannedDistance: item.plannedDistance || '',
      date: item.date || formatDateKey(new Date()),
      details: item.details || '',
      focus: item.focus || '',
      raceType: item.raceType || '',
      activityType: getActivityType(item),
      plannedTss: item.plannedTss || '',
    });
    setShowAddForm(true);
    setSelectedDate(null);
  };

  const handleImportCSV = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const text = e.target.result;
        const rows = parseCsvRows(text);
        if (rows.length < 2) {
          alert('CSV must contain a header row and at least one data row.');
          return;
        }

        const headers = rows[0].map(normalizeHeader);
        const findColumnIndex = (aliases) => {
          for (const alias of aliases) {
            const index = headers.indexOf(normalizeHeader(alias));
            if (index !== -1) return index;
          }
          return -1;
        };

        const dateIdx = findColumnIndex(['Date']);
        const activityIdx = findColumnIndex(['Activity Type', 'Activity']);
        const raceTypeIdx = findColumnIndex(['Race Type']);
        const detailsIdx = findColumnIndex(['Details', 'Distance/Details']);
        const focusIdx = findColumnIndex(['Focus']);
        const plannedDurationIdx = findColumnIndex(['Planned Duration', 'Duration']);
        const plannedDistanceIdx = findColumnIndex(['Planned Distance', 'Distance']);

        if (dateIdx === -1 || activityIdx === -1) {
          alert('Missing required CSV columns. Required: Date and Activity Type (or Activity).');
          return;
        }

        const workouts = [];
        let skippedRows = 0;

        for (let i = 1; i < rows.length; i++) {
          const currentline = rows[i];
          const workout = {};

          workout.date = currentline[dateIdx]?.trim();
          workout.plannedActivity = currentline[activityIdx]?.trim();

          const raceTypeRaw = currentline[raceTypeIdx]?.trim().toUpperCase();
          workout.raceType = ['A', 'B', 'C'].includes(raceTypeRaw) ? raceTypeRaw : '';

          workout.details = currentline[detailsIdx]?.trim();
          workout.focus = currentline[focusIdx]?.trim();
          workout.activityType = getActivityType({ plannedActivity: workout.plannedActivity, details: workout.details });

          const durationFromColumn = parseNumericCell(currentline[plannedDurationIdx]);
          const distanceFromColumn = parseNumericCell(currentline[plannedDistanceIdx]);

          // Fall back to details when explicit duration column is missing.
          const durationMatch = workout.details?.match(/(\d+)\s*m/);
          workout.plannedDuration = durationFromColumn ?? (durationMatch ? parseInt(durationMatch[1], 10) : 60);

          // Fall back to details when explicit distance column is missing.
          const distanceMatch = workout.details?.match(/(\d+(?:\.\d+)?)\s*km/);
          workout.plannedDistance = distanceFromColumn ?? (distanceMatch ? parseFloat(distanceMatch[1]) : null);

          if (workout.date && workout.plannedActivity) {
            workouts.push(workout);
          } else {
            skippedRows++;
          }
        }

        if (workouts.length === 0) {
          alert('No valid rows found to import. Please check Date and Activity columns.');
          return;
        }

        setLoading(true);
        try {
          await importPlannedWorkouts(athleteId, workouts);
          const items = await getPlannedWorkouts(athleteId,
            new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1),
            new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0)
          );
          setPlannerItems(items);

          if (skippedRows > 0) {
            alert(`Imported ${workouts.length} rows. Skipped ${skippedRows} invalid row(s).`);
          }
        } catch (error) {
          console.error('Import failed:', error);
          alert('Import failed. Please check the CSV format and try again.');
        } finally {
          setLoading(false);
        }
      } catch (error) {
        console.error('Failed to parse CSV:', error);
        alert('Could not parse CSV file. Please verify it is a valid CSV.');
      }
    };
    reader.readAsText(file);
    // Clear input
    event.target.value = '';
  };

  const selectedDateItems = useMemo(() => {
    if (!selectedDate) return [];
    return itemsByDate[formatDateKey(selectedDate)] || [];
  }, [selectedDate, itemsByDate]);

  const isToday = (date) => date && formatDateKey(date) === formatDateKey(new Date());

  return (
    <Stack gap="xl">
      <Group justify="space-between" align="center">
        <Title order={1}>Training Planner</Title>
        <Group gap="xl">
          <Group gap="xs">
            <Button variant="subtle" color="gray" size="sm" onClick={handleToday}>Today</Button>
            <Group gap={5}>
              <Button size="xs" variant="subtle" onClick={handlePrevMonth}>‹</Button>
              <Text fw={700} w={100} ta="center" size="sm">
                {currentMonth.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
              </Text>
              <Button size="xs" variant="subtle" onClick={handleNextMonth}>›</Button>
            </Group>
          </Group>

          <SegmentedControl
            value={viewMode}
            onChange={setViewMode}
            size="sm"
            radius="md"
            data={[
              { label: <Center gap={6}><IconCalendar size={14} />Planned</Center>, value: 'planned' },
              { label: <Center gap={6}><IconBrandStrava size={14} />Actual</Center>, value: 'actual' },
              { label: 'All', value: 'all' },
            ]}
          />

          <Group gap="xs">
            <Button
              variant="light"
              leftSection={<IconUpload size={16} />}
              size="sm"
              component="label"
            >
              Import CSV
              <input type="file" accept=".csv" hidden onChange={handleImportCSV} />
            </Button>
            <Button variant="filled" size="sm" onClick={() => setShowAddForm(true)}>+ Plan</Button>
          </Group>
        </Group>
      </Group>

      <Paper withBorder radius="lg" p={0} style={{ overflow: 'hidden', backgroundColor: 'var(--mantine-color-midnight-9)' }}>
        <Box bg="midnight.9" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
          <SimpleGrid cols={isMobile ? 1 : 8} spacing={0}>
            {!isMobile && ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun', 'Weekly'].map(day => (
              <Box key={day} py="md" ta="center">
                <Text size="11px" fw={900} tt="uppercase" c="dimmed" ls="1px">{day}</Text>
              </Box>
            ))}
            {isMobile && (
              <Box py="md" px="md">
                <Text size="13px" fw={900} tt="uppercase" c="blue" ls="1px">Month Schedule</Text>
              </Box>
            )}
          </SimpleGrid>
        </Box>

        <Stack gap={0}>
          {weeks.map((week, wIdx) => {
            const totals = getWeekTotals(week, itemsByDate);
            return (
              <SimpleGrid key={wIdx} cols={isMobile ? 1 : 8} spacing={0} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                {week.map((day, dIdx) => {
                  const dateKey = day ? formatDateKey(day) : null;
                  const items = dateKey ? (itemsByDate[dateKey] || []) : [];
                  const isOtherMonth = day && day.getMonth() !== currentMonth.getMonth();

                  return (
                    <Box
                      key={dIdx}
                      p={isMobile ? 'md' : 'sm'}
                      style={{
                        minHeight: isMobile ? 'auto' : rem(150),
                        borderRight: (isMobile || dIdx === 7) ? 'none' : '1px solid rgba(255,255,255,0.05)',
                        borderBottom: isMobile ? '1px solid rgba(255,255,255,0.05)' : 'none',
                        backgroundColor: isToday(day) ? 'rgba(33, 150, 243, 0.08)' : 'transparent',
                        opacity: isOtherMonth ? 0.3 : 1,
                        transition: 'background-color 0.2s ease',
                        overflow: 'hidden',
                        position: 'relative'
                      }}
                      onMouseEnter={(e) => day && (e.currentTarget.style.backgroundColor = isToday(day) ? 'rgba(33, 150, 243, 0.12)' : 'rgba(255,255,255,0.02)')}
                      onMouseLeave={(e) => day && (e.currentTarget.style.backgroundColor = isToday(day) ? 'rgba(33, 150, 243, 0.08)' : 'transparent')}
                      onClick={() => day && setSelectedDate(day)}
                      onDragOver={handleDragOver}
                      onDrop={(e) => day && handleDrop(e, day)}
                    >
                      {day && (
                        <Group align="flex-start" wrap={isMobile ? 'nowrap' : 'wrap'} gap="md">
                          <Stack gap={2} w={isMobile ? 40 : '100%'} align="center">
                            <Text size={isMobile ? 'md' : 'sm'} fw={900} c={isToday(day) ? 'blue' : 'dimmed'}>
                              {day.getDate()}
                            </Text>
                            {isMobile && <Text size="10px" fw={700} tt="uppercase" opacity={0.5}>{['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][(day.getDay() + 6) % 7]}</Text>}
                          </Stack>

                          <Stack gap={6} style={{ flex: 1, minWidth: 0 }}>
                            {items.length === 0 ? (
                              <Paper
                                withBorder
                                px={10}
                                py={8}
                                radius="md"
                                bg="gray.8"
                                style={{
                                  borderColor: 'rgba(255,255,255,0.1)',
                                  borderWidth: '1px',
                                }}
                              >
                                <Stack gap={0}>
                                  <Group justify="space-between" align="center" wrap="nowrap" mb={2}>
                                    <Group gap={6} wrap="nowrap" style={{ flex: 1, overflow: 'hidden' }}>
                                      <Box style={{ opacity: 0.9, display: 'flex' }}>
                                        <IconMoon size={14} color="white" />
                                      </Box>
                                      <Text size="xs" fw={900} c="white" ls="0.5px" lh={1.2} truncate="end" style={{ flex: 1 }}>
                                        Rest Day
                                      </Text>
                                    </Group>
                                  </Group>
                                </Stack>
                              </Paper>
                            ) : (
                              items.map((item, iIdx) => {
                                const type = getActivityType(item);
                                const config = ACTIVITY_CONFIG[type] || ACTIVITY_CONFIG.workout;
                                const isRaceA = item.raceType === 'A';
                                const isDone = item.status === 'done';

                                return (
                                  <Paper
                                    key={iIdx}
                                    draggable={!item.isActual}
                                    onDragStart={(e) => !item.isActual && handleDragStart(e, item)}
                                    onDragEnd={handleDragEnd}
                                    withBorder
                                    px={10}
                                    py={8}
                                    radius="md"
                                    bg={item.isActual ? 'rgba(252, 76, 2, 0.15)' : (isDone ? 'dark.6' : config.color)}
                                    style={{
                                      borderColor: item.isActual ? '#FC4C02' : (isRaceA ? 'var(--mantine-color-yellow-6)' : (isDone ? 'var(--mantine-color-green-8)' : 'rgba(255,255,255,0.1)')),
                                      borderWidth: (isRaceA || item.isActual) ? '2px' : '1px',
                                      boxShadow: isRaceA ? '0 0 10px rgba(255,215,0,0.2)' : '0 4px 6px rgba(0,0,0,0.1)',
                                      cursor: item.isActual ? 'default' : 'grab',
                                      transition: 'transform 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
                                      opacity: isDone ? 0.7 : 1,
                                    }}
                                    onMouseEnter={(e) => !item.isActual && (e.currentTarget.style.transform = 'scale(1.02) translateY(-2px)')}
                                    onMouseLeave={(e) => !item.isActual && (e.currentTarget.style.transform = 'scale(1) translateY(0)')}
                                    onClick={(e) => {
                                      if (!item.isActual) {
                                        e.stopPropagation();
                                        setSelectedDate(new Date(item.date + 'T00:00:00'));
                                      }
                                    }}
                                  >
                                    <Stack gap={0}>
                                      <Group justify="space-between" align="center" wrap="nowrap" mb={2}>
                                        <Group gap={6} wrap="nowrap" style={{ flex: 1, overflow: 'hidden' }}>
                                          <Box style={{ opacity: 0.9, display: 'flex' }}>
                                            {item.isActual ? <IconBrandStrava size={14} color="#FC4C02" /> : (isDone ? <IconCheck size={14} color="var(--mantine-color-green-4)" /> : config.icon)}
                                          </Box>
                                          <Text size="xs" fw={900} c={isDone ? 'dimmed' : 'white'} ls="0.5px" lh={1.2} truncate="end" style={{ flex: 1, textDecoration: isDone ? 'line-through' : 'none' }}>
                                            {isRaceA && '🏆 '}{item.plannedActivity}
                                          </Text>
                                        </Group>
                                        {!item.isActual && <IconArrowsMove size={10} color="white" style={{ opacity: 0.5, flexShrink: 0 }} />}
                                      </Group>
                                      {(item.plannedDistance || item.plannedDuration) && (
                                        <Group gap={4} mt={4}>
                                          {item.plannedDistance && (
                                            <Badge size="xs" variant="light" color={item.isActual ? "orange" : "gray"} style={{ textTransform: 'none' }}>
                                              {item.plannedDistance} Km
                                            </Badge>
                                          )}
                                          {item.plannedDuration && (
                                            <Badge size="xs" variant="light" color={item.isActual ? "orange" : "gray"} style={{ textTransform: 'none' }}>
                                              {item.plannedDuration} min
                                            </Badge>
                                          )}
                                        </Group>
                                      )}
                                    </Stack>
                                  </Paper>
                                );
                              })
                            )}
                          </Stack>
                        </Group>
                      )}
                    </Box>
                  );
                })}
                <Box
                  p="md"
                  bg="rgba(255,255,255,0.02)"
                  ta="center"
                  style={{ borderLeft: isMobile ? 'none' : '1px solid rgba(255,255,255,0.05)' }}
                >
                  {totals.total > 0 && (
                    <Stack gap="xs" justify="center" h="100%">
                      <Text size="xs" fw={900} c="blue" tt="uppercase" ls="1px">Week {wIdx + 1}</Text>
                      <Divider opacity={0.1} />
                      <Stack gap={4}>
                        <Group justify="center" gap={4}>
                          <Text size="10px" fw={600} c="dimmed">PLANNED:</Text>
                          <Text size="10px" fw={900}>{Math.round(totals.plannedMinutes / 60)}h</Text>
                        </Group>
                        <Group justify="center" gap={4}>
                          <Text size="10px" fw={600} c="orange">ACTUAL:</Text>
                          <Text size="10px" fw={900} c="orange">{Math.round(totals.actualMinutes / 60)}h</Text>
                        </Group>
                        <Group justify="center" gap={4}>
                          <Text size="10px" fw={600} c="dimmed">LOAD:</Text>
                          <Text size="10px" fw={900}>{totals.plannedTSS}</Text>
                        </Group>
                        <Group justify="center" gap={4}>
                          <Text size="10px" fw={600} c="orange">ACTUAL LOAD:</Text>
                          <Text size="10px" fw={900} c="orange">{totals.actualTSS}</Text>
                        </Group>
                      </Stack>
                      <Badge
                        variant="filled"
                        size="sm"
                        color={totals.completed === totals.total ? 'green' : 'blue'}
                        styles={{ label: { fontSize: '10px', fontWeight: 800 } }}
                      >
                        {totals.completed}/{totals.total} DONE
                      </Badge>
                      <Badge
                        variant="light"
                        size="sm"
                        color={Math.round((totals.completed / totals.total) * 100) >= 80 ? 'teal' : (Math.round((totals.completed / totals.total) * 100) >= 50 ? 'yellow' : 'red')}
                        styles={{ label: { fontSize: '11px', fontWeight: 900 } }}
                      >
                        {Math.round((totals.completed / totals.total) * 100)}% ✓
                      </Badge>
                      <Button
                        variant="light"
                        size="xs"
                        leftSection={<IconCopy size={14} />}
                        onClick={() => copyWeeklyData(week, wIdx)}
                        fullWidth
                        mt="xs"
                      >
                        Copy
                      </Button>
                    </Stack>
                  )}
                </Box>
              </SimpleGrid>
            );
          })}
        </Stack>
      </Paper>

      <Modal
        opened={!!selectedDate}
        onClose={() => setSelectedDate(null)}
        title={selectedDate?.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
        size="md"
        radius="lg"
      >
        <Stack gap="md">
          {selectedDateItems.length === 0 ? (
            <Text c="dimmed" ta="center" py="lg">No activities planned.</Text>
          ) : (
            selectedDateItems.map((item, idx) => (
              <Paper key={idx} withBorder p="md" radius="md" bg="midnight.8">
                <Group justify="space-between" mb="xs">
                  <Group gap="xs">
                    <Text fw={700}>{item.plannedActivity}</Text>
                    {item.raceType && <Badge size="xs" color="orange" variant="light">{item.raceType} Race</Badge>}
                  </Group>
                  <Group gap="xs">
                    {!item.isActual && (
                      <Group gap="xs">
                        <Button variant="subtle" size="compact-xs" onClick={() => handleEditClick(item)}>Edit</Button>
                        <Button
                          variant="subtle"
                          color="red"
                          size="compact-xs"
                          leftSection={<IconTrash size={12} />}
                          onClick={() => {
                            if (confirm('Delete this planned workout?')) {
                              handleDeleteWorkout(item.id);
                            }
                          }}
                        >
                          Delete
                        </Button>
                        {item.stravaActivityId && (
                          <Button
                            variant="subtle"
                            color="orange"
                            size="compact-xs"
                            leftSection={<IconUnlink size={12} />}
                            onClick={async () => {
                              if (confirm('Unlink Strava activity? This will reset the workout to pending.')) {
                                await unlinkActivityFromWorkout(athleteId, item.id);
                                const updated = await getPlannedWorkouts(athleteId,
                                  new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1),
                                  new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0)
                                );
                                setPlannerItems(updated);
                                setSelectedDate(null);
                              }
                            }}
                          >
                            Unlink
                          </Button>
                        )}
                      </Group>
                    )}
                    <Badge
                      color={item.isActual ? 'orange' : getStatusColor(item.status, item.raceType, item.plannedActivity)}
                      variant={item.isActual ? 'light' : 'filled'}
                    >
                      {item.isActual ? 'Strava' : item.status}
                    </Badge>
                  </Group>
                </Group>
                <Divider mb="xs" opacity={0.5} />
                <Stack gap="sm">
                  <Group justify="space-between">
                    <Stack gap={4}>
                      <Text size="xs"><b>Planned:</b> {item.plannedDuration} min</Text>
                      {item.details && (
                        <Paper p="xs" radius="sm" bg="rgba(255,255,255,0.03)" withBorder>
                          <Text size="xs" c="dimmed" fw={700} mb={4}>Details</Text>
                          <Text size="sm" fw={500} style={{ whiteSpace: 'pre-line', wordBreak: 'break-word' }}>
                            {item.details}
                          </Text>
                        </Paper>
                      )}
                      {item.focus && (
                        <Paper p="xs" radius="sm" bg="rgba(255,255,255,0.03)" withBorder>
                          <Text size="xs" c="dimmed" fw={700} mb={4}>Focus</Text>
                          <Text size="sm" style={{ whiteSpace: 'pre-line', wordBreak: 'break-word' }}>
                            {item.focus}
                          </Text>
                        </Paper>
                      )}
                    </Stack>
                    {!item.isActual && (
                      <Button
                        size="xs"
                        variant="light"
                        color={item.status === 'done' ? 'gray' : 'green'}
                        onClick={async () => {
                          await savePlannedWorkout(athleteId, {
                            ...item,
                            status: item.status === 'done' ? 'pending' : 'done',
                            actualDuration: item.status === 'done' ? undefined : item.plannedDuration,
                            actualActivity: item.status === 'done' ? undefined : 'Manually Completed',
                            completionSource: item.status === 'done' ? undefined : 'manual'
                          });
                          const updated = await getPlannedWorkouts(athleteId,
                            new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1),
                            new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0)
                          );
                          setPlannerItems(updated);
                        }}
                      >
                        {item.status === 'done' ? 'Undo Completion' : 'Mark as Done'}
                      </Button>
                    )}
                  </Group>
                  {item.actualActivity && (
                    <Paper p="xs" bg="rgba(0,0,0,0.2)" radius="sm" withBorder>
                      <Text size="xs" c={item.status === 'done' ? 'green' : 'dimmed'}>
                        <b>Actual:</b> {item.actualActivity} ({item.actualDuration} min{item.actualDistance ? ` • ${item.actualDistance}km` : ''})
                      </Text>
                    </Paper>
                  )}
                </Stack>
              </Paper>
            ))
          )}
          <Button fullWidth variant="light" onClick={() => {
            setNewWorkout({
              plannedActivity: '',
              plannedDuration: 30,
              plannedDistance: '',
              date: selectedDate ? formatDateKey(selectedDate) : formatDateKey(new Date()),
              details: '',
              focus: '',
              raceType: '',
              activityType: 'run',
              plannedTss: ''
            });
            setShowAddForm(true);
            setSelectedDate(null);
          }}>+ Add Workout</Button>
        </Stack>
      </Modal>

      <Modal
        opened={showAddForm}
        onClose={() => setShowAddForm(false)}
        title={newWorkout.id ? "Edit Planned Workout" : "Plan a Workout"}
        radius="lg"
      >
        <Stack gap="md">
          <Select
            label="Activity Type"
            placeholder="Select type"
            data={[
              { value: 'run', label: 'Run' },
              { value: 'cycle', label: 'Cycle' },
              { value: 'swim', label: 'Swim' },
              { value: 'strength', label: 'Strength' },
              { value: 'mobility', label: 'Mobility/Yoga' },
              { value: 'rest', label: 'Rest' },
              { value: 'workout', label: 'Workout/Other' },
            ]}
            value={newWorkout.activityType}
            onChange={(val) => setNewWorkout({ ...newWorkout, activityType: val })}
            required
          />
          <TextInput
            label="Activity Name"
            placeholder="e.g. 10km Easy Run"
            value={newWorkout.plannedActivity}
            onChange={(e) => setNewWorkout({ ...newWorkout, plannedActivity: e.target.value })}
            required
          />
          <NumberInput
            label="Duration (minutes)"
            value={newWorkout.plannedDuration}
            onChange={(val) => setNewWorkout({ ...newWorkout, plannedDuration: val })}
            min={1}
            required
          />
          <SimpleGrid cols={2}>
            <NumberInput
              label="Distance (km)"
              placeholder="Optional"
              value={newWorkout.plannedDistance}
              onChange={(val) => setNewWorkout({ ...newWorkout, plannedDistance: val })}
              min={0}
              step={0.1}
              decimalScale={2}
            />
            <NumberInput
              label="Planned Load"
              placeholder="Load estimate"
              value={newWorkout.plannedTss}
              onChange={(val) => setNewWorkout({ ...newWorkout, plannedTss: val })}
              min={0}
            />
          </SimpleGrid>
          <TextInput
            label="Date"
            type="date"
            value={newWorkout.date}
            onChange={(e) => setNewWorkout({ ...newWorkout, date: e.target.value })}
            required
          />
          <Select
            label="Race Type"
            placeholder="Select race priority"
            data={['', 'A', 'B', 'C']}
            value={newWorkout.raceType}
            onChange={(val) => setNewWorkout({ ...newWorkout, raceType: val })}
            clearable
          />
          <Textarea
            label="Focus"
            placeholder="e.g. Endurance Base"
            value={newWorkout.focus}
            onChange={(e) => setNewWorkout({ ...newWorkout, focus: e.target.value })}
            minRows={3}
            autosize
          />
          <Textarea
            label="Details"
            placeholder="e.g. 10km Easy (9:00 pace)"
            value={newWorkout.details}
            onChange={(e) => setNewWorkout({ ...newWorkout, details: e.target.value })}
            minRows={3}
            autosize
          />
          <Group justify="flex-end" mt="md">
            <Button variant="subtle" color="gray" onClick={() => setShowAddForm(false)}>Cancel</Button>
            <Button onClick={handleAddWorkout}>{newWorkout.id ? "Update Plan" : "Save Plan"}</Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
};

export default Planner;
