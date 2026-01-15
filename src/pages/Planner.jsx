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
import { IconUpload, IconTrash, IconArrowsMove, IconRun, IconBike, IconBarbell, IconYoga, IconPool, IconMoon, IconBrandStrava, IconCalendar, IconUnlink } from '@tabler/icons-react';
import { getStoredAuthData, getAthleteActivities, isTokenExpired, refreshAccessToken, storeAuthData } from '../utils/stravaApi';
import { calculateTSS } from '../utils/metrics';

const ACTIVITY_CONFIG = {
  run: { color: 'red.7', icon: <IconRun size={14} />, gradient: 'linear-gradient(45deg, #FF6B6B 0%, #D6336C 100%)' },
  cycle: { color: 'blue.7', icon: <IconBike size={14} />, gradient: 'linear-gradient(45deg, #4DABF7 0%, #339AF0 100%)' },
  swim: { color: 'cyan.7', icon: <IconPool size={14} />, gradient: 'linear-gradient(45deg, #20C997 0%, #08979C 100%)' },
  strength: { color: 'violet.7', icon: <IconBarbell size={14} />, gradient: 'linear-gradient(45deg, #845EF7 0%, #7048E8 100%)' },
  mobility: { color: 'teal.7', icon: <IconYoga size={14} />, gradient: 'linear-gradient(45deg, #12B886 0%, #0CA678 100%)' },
  rest: { color: 'gray.7', icon: <IconMoon size={14} />, gradient: 'linear-gradient(45deg, #868E96 0%, #495057 100%)' },
  workout: { color: 'indigo.7', icon: <IconBarbell size={14} />, gradient: 'linear-gradient(45deg, #5C7CFA 0%, #4263EB 100%)' },
};

function groupByDate(items) {
  return items.reduce((acc, item) => {
    if (!acc[item.date]) acc[item.date] = [];
    acc[item.date].push(item);
    return acc;
  }, {});
}

function getActivityType(item) {
  const rawType = (item.activityType || '').toLowerCase();
  if (rawType === 'run') return 'run';
  if (rawType === 'ride' || rawType === 'cycle' || rawType === 'ebikeride' || rawType === 'virtualride') return 'cycle';
  if (rawType === 'swim') return 'swim';
  if (rawType === 'weighttraining' || rawType === 'strength') return 'strength';
  if (rawType === 'yoga' || rawType === 'mobility') return 'mobility';

  if (item.activityType) return item.activityType.toLowerCase();

  const name = (item.plannedActivity || '').toLowerCase();
  const details = (item.details || '').toLowerCase();
  const combined = `${name} ${details}`;
  if (combined.includes('run')) return 'run';
  if (combined.includes('ride') || combined.includes('cycle') || combined.includes('spin') || combined.includes('bike')) return 'cycle';
  if (combined.includes('swim')) return 'swim';
  if (combined.includes('strength') || combined.includes('gym') || combined.includes('lift') || combined.includes('weight')) return 'strength';
  if (combined.includes('mobility') || combined.includes('rehab') || combined.includes('yoga') || combined.includes('stretch')) return 'mobility';
  if (combined.includes('rest')) return 'rest';
  if (combined.includes('workout')) return 'workout';
  return 'run'; // Default
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

function estimatePlannedTSS(item) {
  const durationHours = (item.plannedDuration || 0) / 60;
  const activityType = getActivityType(item);
  
  // Base TSS per hour based on activity type and intensity
  let baseTSSPerHour = 50; // Default moderate intensity
  
  if (activityType === 'run') {
    // Check for intensity indicators in activity name or details
    const nameAndDetails = `${item.plannedActivity} ${item.details || ''}`.toLowerCase();
    if (nameAndDetails.includes('easy') || nameAndDetails.includes('recovery')) {
      baseTSSPerHour = 30;
    } else if (nameAndDetails.includes('tempo') || nameAndDetails.includes('steady') || nameAndDetails.includes('threshold')) {
      baseTSSPerHour = 70;
    } else if (nameAndDetails.includes('interval') || nameAndDetails.includes('speed') || nameAndDetails.includes('vo2')) {
      baseTSSPerHour = 90;
    } else if (nameAndDetails.includes('race') || nameAndDetails.includes('competition')) {
      baseTSSPerHour = 100;
    }
  } else if (activityType === 'cycle') {
    const nameAndDetails = `${item.plannedActivity} ${item.details || ''}`.toLowerCase();
    if (nameAndDetails.includes('easy') || nameAndDetails.includes('recovery')) {
      baseTSSPerHour = 40;
    } else if (nameAndDetails.includes('tempo') || nameAndDetails.includes('steady')) {
      baseTSSPerHour = 60;
    } else if (nameAndDetails.includes('interval') || nameAndDetails.includes('vo2')) {
      baseTSSPerHour = 80;
    } else if (nameAndDetails.includes('race') || nameAndDetails.includes('competition')) {
      baseTSSPerHour = 120;
    }
  } else if (activityType === 'strength' || activityType === 'workout') {
    baseTSSPerHour = 40; // Strength training has lower TSS
  } else if (activityType === 'rest' || activityType === 'mobility') {
    baseTSSPerHour = 10; // Very low TSS for recovery activities
  }
  
  return Math.round(durationHours * baseTSSPerHour);
}

function getWeekTotals(week, itemsByDate) {
  let plannedMinutes = 0, actualMinutes = 0, completed = 0, total = 0, plannedTSS = 0, actualTSS = 0;
  week.forEach(day => {
    if (!day) return;
    const items = itemsByDate[formatDateKey(day)] || [];
    items.forEach(item => {
      plannedMinutes += item.plannedDuration || 0;
      actualMinutes += item.actualDuration || 0;
      total++;
      if (item.status === 'done') completed++;
      
      // Calculate TSS
      if (item.isActual) {
        // For actual activities, use the calculateTSS function
        actualTSS += item.tss || calculateTSS(item, null) || 0;
      } else {
        // For planned activities, estimate TSS based on duration and activity type
        const estimatedTSS = estimatePlannedTSS(item);
        plannedTSS += estimatedTSS;
        if (item.status === 'done') {
          actualTSS += estimatedTSS; // Use estimated TSS for completed planned activities
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

        // Fetch Planned
        const planned = await getPlannedWorkouts(athleteId, startOfMonth, endOfMonth);
        setPlannerItems(planned);

        // Fetch Actual from Firebase
        const strava = await getActivitiesByDateRange(athleteId, startOfMonth, endOfMonth);
        const transformed = strava.map(act => ({
          id: `strava-${act.id}`,
          plannedActivity: act.name,
          plannedDuration: Math.round((act.moving_time || 0) / 60),
          actualDuration: Math.round((act.moving_time || 0) / 60),
          date: (act.start_date_local || act.start_date).split('T')[0],
          details: `${((act.distance || 0) / 1000).toFixed(2)}km • ${act.type}`,
          status: 'done',
          isActual: true,
          activityType: (act.sport_type || act.type || '').toLowerCase()
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
          activityType: 'run'
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
    });
    setShowAddForm(true);
    setSelectedDate(null);
  };

  const handleImportCSV = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      const text = e.target.result;
      const lines = text.split('\n');
      const headers = lines[0].split(',');
      const workouts = [];

      for (let i = 1; i < lines.length; i++) {
        if (!lines[i].trim()) continue;

        // Basic CSV parsing (handles simple cases without commas in quotes)
        const currentline = lines[i].split(',');
        const workout = {};

        // Expected columns: Week,Date,Day,Activity Type,Race Type,Details,Focus
        // Mapping:
        // Index 1: Date
        // Index 3: Activity Type -> plannedActivity
        // Index 4: Race Type -> raceType
        // Index 5: Details -> details
        // Index 6: Focus -> focus

        workout.date = currentline[1]?.trim();
        workout.plannedActivity = currentline[3]?.trim();
        workout.raceType = currentline[4]?.trim();
        workout.details = currentline[5]?.trim();
        workout.focus = currentline[6]?.trim();
        workout.activityType = getActivityType({ plannedActivity: workout.plannedActivity, details: workout.details });

        // Extract duration from details (e.g. "30m", "45m")
        const durationMatch = workout.details?.match(/(\d+)\s*m/);
        workout.plannedDuration = durationMatch ? parseInt(durationMatch[1]) : 60;

        // Extract distance from details (e.g. "10km", "5km")
        const distanceMatch = workout.details?.match(/(\d+(?:\.\d+)?)\s*km/);
        workout.plannedDistance = distanceMatch ? parseFloat(distanceMatch[1]) : null;

        if (workout.date && workout.plannedActivity) {
          workouts.push(workout);
        }
      }

      if (workouts.length > 0) {
        setLoading(true);
        try {
          await importPlannedWorkouts(athleteId, workouts);
          const items = await getPlannedWorkouts(athleteId,
            new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1),
            new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0)
          );
          setPlannerItems(items);
        } catch (error) {
          console.error('Import failed:', error);
        } finally {
          setLoading(false);
        }
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
                                      <Text size="11px" fw={900} c="white" ls="0.5px" truncate="end" style={{ flex: 1 }}>
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
                                    bg={item.isActual ? 'rgba(252, 76, 2, 0.15)' : (isDone ? 'green.8' : (isRaceA ? 'maroon' : config.color))}
                                    style={{
                                      backgroundImage: item.isActual ? 'linear-gradient(45deg, rgba(252, 76, 2, 0.2) 0%, rgba(252, 76, 2, 0) 100%)' : (isDone ? 'none' : config.gradient),
                                      borderColor: item.isActual ? '#FC4C02' : (isRaceA ? 'var(--mantine-color-yellow-4)' : 'rgba(255,255,255,0.1)'),
                                      borderWidth: (isRaceA || item.isActual) ? '2px' : '1px',
                                      boxShadow: isRaceA ? '0 0 15px rgba(255,215,0,0.5), inset 0 0 5px rgba(255,255,255,0.2)' : '0 4px 6px rgba(0,0,0,0.1)',
                                      cursor: item.isActual ? 'default' : 'grab',
                                      transition: 'transform 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
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
                                            {item.isActual ? <IconBrandStrava size={14} color="#FC4C02" /> : config.icon}
                                          </Box>
                                          <Text size="11px" fw={900} c="white" ls="0.5px" truncate="end" style={{ flex: 1 }}>
                                            {isRaceA && '🏆 '}{item.plannedActivity}
                                          </Text>
                                        </Group>
                                        {!item.isActual && <IconArrowsMove size={10} color="white" style={{ opacity: 0.5, flexShrink: 0 }} />}
                                      </Group>
                                      <Text size="10px" c="white" opacity={0.8} truncate="end" fw={500}>
                                        {item.details}
                                      </Text>
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
                          <Text size="10px" fw={600} c="dimmed">TSS:</Text>
                          <Text size="10px" fw={900}>{totals.plannedTSS}</Text>
                        </Group>
                        <Group justify="center" gap={4}>
                          <Text size="10px" fw={600} c="orange">ACTUAL TSS:</Text>
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
                      {item.details && <Text size="sm" fw={500}>{item.details}</Text>}
                      {item.focus && <Badge size="xs" variant="outline">{item.focus}</Badge>}
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
              activityType: 'run'
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
          <NumberInput
            label="Distance (km)"
            placeholder="Optional"
            value={newWorkout.plannedDistance}
            onChange={(val) => setNewWorkout({ ...newWorkout, plannedDistance: val })}
            min={0}
            step={0.1}
            decimalScale={2}
          />
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
          <TextInput
            label="Focus"
            placeholder="e.g. Endurance Base"
            value={newWorkout.focus}
            onChange={(e) => setNewWorkout({ ...newWorkout, focus: e.target.value })}
          />
          <TextInput
            label="Details"
            placeholder="e.g. 10km Easy (9:00 pace)"
            value={newWorkout.details}
            onChange={(e) => setNewWorkout({ ...newWorkout, details: e.target.value })}
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
