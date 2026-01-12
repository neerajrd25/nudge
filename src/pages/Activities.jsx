import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Container,
  Stack,
  Group,
  Title,
  Text,
  Button,
  Select,
  Card,
  Badge,
  Progress,
  Skeleton,
  Modal,
  Loader,
  SimpleGrid,
  Paper,
  ActionIcon,
  Tooltip,
  Box,
  rem,
  Divider,
  Grid,
  SegmentedControl,
} from '@mantine/core';
import {
  IconRun,
  IconBike,
  IconSwimming,
  IconWalk,
  IconMountain,
  IconBarbell,
  IconTrophy,
  IconCloudUpload,
  IconRefresh,
  IconFilter
} from '@tabler/icons-react';
import {
  getStoredAuthData,
  getAllAthleteActivities,
  getAthleteActivities,
  refreshAccessToken,
  storeAuthData,
  isTokenExpired,
} from '../utils/stravaApi';
import { getActivityFromFirebase, getActivitiesFromFirebase, storeActivitiesInFirebase, getAthleteSettings } from '../utils/firebaseService';
import { autoMatchActivities, manualLinkActivityToWorkout } from '../utils/plannerService';
import { MetricCard } from '../components/ui/MetricCard';

function Activities() {
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [syncStatus, setSyncStatus] = useState(null);
  const [displayLimit, setDisplayLimit] = useState(20);
  const [syncing, setSyncing] = useState(false);
  const [progressPercent, setProgressPercent] = useState(0);
  const [processedCount, setProcessedCount] = useState(0);
  const [currentPageIdx, setCurrentPageIdx] = useState(0);
  const [currentMessage, setCurrentMessage] = useState('Preparing sync...');
  const [lastStartDateCursor, setLastStartDateCursor] = useState(null);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [filterType, setFilterType] = useState('');
  const [monthlyStats, setMonthlyStats] = useState({
    current: { count: 0, distance: 0, time: 0, elevation: 0, monthName: '' },
    previous: { count: 0, distance: 0, time: 0, elevation: 0, monthName: '' }
  });
  const navigate = useNavigate();

  const calculateStats = (allActivities) => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    
    const prevMonthDate = new Date(currentYear, currentMonth - 1, 1);
    const prevMonth = prevMonthDate.getMonth();
    const prevMonthYear = prevMonthDate.getFullYear();

    const currentStats = { count: 0, distance: 0, time: 0, elevation: 0, monthName: now.toLocaleString('default', { month: 'long' }) };
    const previousStats = { count: 0, distance: 0, time: 0, elevation: 0, monthName: prevMonthDate.toLocaleString('default', { month: 'long' }) };

    allActivities.forEach(activity => {
      const date = new Date(activity.start_date);
      const m = date.getMonth();
      const y = date.getFullYear();

      if (m === currentMonth && y === currentYear) {
        currentStats.count++;
        currentStats.distance += (activity.distance || 0);
        currentStats.time += (activity.moving_time || 0);
        currentStats.elevation += (activity.total_elevation_gain || 0);
      } else if (m === prevMonth && y === prevMonthYear) {
        previousStats.count++;
        previousStats.distance += (activity.distance || 0);
        previousStats.time += (activity.moving_time || 0);
        previousStats.elevation += (activity.total_elevation_gain || 0);
      }
    });

    setMonthlyStats({ current: currentStats, previous: previousStats });
  };

  const formatTrend = (current, previous, unit = '', isDistance = false) => {
    const diff = current - previous;
    const sign = diff >= 0 ? '+' : '-';
    const absDiff = Math.abs(diff);
    let displayDiff = absDiff;
    
    if (isDistance) {
      displayDiff = (absDiff / 1000).toFixed(1);
    } else if (typeof absDiff === 'number' && !Number.isInteger(absDiff)) {
      displayDiff = absDiff.toFixed(1);
    }

    return `${sign}${displayDiff}${unit} vs ${monthlyStats.previous.monthName}`;
  };

  const formatDurationTrend = (currentSec, previousSec) => {
    const diff = currentSec - previousSec;
    const sign = diff >= 0 ? '+' : '-';
    const absDiff = Math.abs(diff);
    const hours = Math.floor(absDiff / 3600);
    const minutes = Math.floor((absDiff % 3600) / 60);
    const timeStr = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
    return `${sign}${timeStr} vs ${monthlyStats.previous.monthName}`;
  };

  const syncWithStrava = async (isManual = false) => {
    try {
      const authData = getStoredAuthData();
      if (!authData || !authData.accessToken) return;
      const athleteId = String(authData.athlete.id);

      // 1. Get settings and current state (last activity date)
      const [userSettings, existing] = await Promise.all([
        getAthleteSettings(athleteId),
        getActivitiesFromFirebase(athleteId, 1, null, filterType)
      ]);

      let accessToken = authData.accessToken;
      if (isTokenExpired() && authData.refreshToken) {
        if (isManual) setSyncStatus('Refreshing Strava token...');
        const newAuthData = await refreshAccessToken(authData.refreshToken);
        storeAuthData(newAuthData);
        accessToken = newAuthData.access_token;
      }

      let afterSec = null;
      if (existing && existing.length > 0) {
        const last = existing[0];
        const dt = last.start_date || last.start_date_local;
        if (dt) afterSec = Math.floor(new Date(dt).getTime() / 1000);
      }

      if (isManual) setLoading(true);
      setSyncing(true);
      setProgressPercent(10);
      
      const perPage = 200;
      let page = 1;
      let anyStored = 0;
      const allPotential = [];
      const allMatched = [];

      const messages = ['Syncing with Strava...', 'Checking for new activities...', 'Updating your training log...', 'Persistent metrics incoming...'];
      let msgIdx = 0;

      const msgInterval = setInterval(() => {
        msgIdx = (msgIdx + 1) % messages.length;
        setCurrentMessage(messages[msgIdx]);
      }, 3000);

      while (true) {
        setCurrentPageIdx(page);
        const pageActivities = await getAthleteActivities(accessToken, page, perPage, afterSec);
        if (!pageActivities || pageActivities.length === 0) break;

        const res = await storeActivitiesInFirebase(athleteId, pageActivities, userSettings);
        anyStored += (res && res.count) ? res.count : pageActivities.length;
        
        // Match with planned workouts
        const matches = await autoMatchActivities(athleteId, pageActivities);
        if (matches.matched && matches.matched.length > 0) allMatched.push(...matches.matched);
        if (matches.potential && matches.potential.length > 0) allPotential.push(...matches.potential);

        setProcessedCount(anyStored);
        setProgressPercent(Math.min(95, page * 10));
        if (pageActivities.length < perPage) break;
        page += 1;
      }

      clearInterval(msgInterval);
      setProgressPercent(100);

      // Show potential match suggestions if any
      if (allPotential.length > 0) {
        const workoutMap = new Map();
        allPotential.forEach(({ activity, potentialWorkouts }) => {
          potentialWorkouts.forEach(workout => {
            if (!workoutMap.has(workout.id)) {
              workoutMap.set(workout.id, { workout, activities: [] });
            }
            workoutMap.get(workout.id).activities.push(activity);
          });
        });
        setAvailableWorkoutsMap(workoutMap);
        setShowMatchModal(true);
      }

      // Success notification
      if (anyStored > 0 || isManual) {
        let statusMsg = anyStored > 0 ? `✓ Synced ${anyStored} new activities.` : 'Already up to date.';
        if (allMatched.length > 0) statusMsg += ` ${allMatched.length} matched to plan.`;
        setSyncStatus(statusMsg);
        
        // Reload from Firebase (The Source of Truth)
        let refreshed = await getActivitiesFromFirebase(athleteId, 500, null, filterType);
        if (filterType === '') {
          refreshed = refreshed.filter(a => a.type !== 'Walk');
        }
        setActivities(refreshed);
        calculateStats(refreshed);
        if (refreshed && refreshed.length > 0) {
          setLastStartDateCursor(refreshed[refreshed.length - 1].start_date || refreshed[refreshed.length - 1].start_date_local || null);
        }
      }

    } catch (err) {
      console.error('Strava Sync Error:', err);
      setSyncStatus('Sync failed');
    } finally {
      setSyncing(false);
      setLoading(false);
      setTimeout(() => setSyncStatus(null), 3000);
    }
  };

  const loadActivitiesFromFirebase = async () => {
    try {
      setLoading(true);
      const authData = getStoredAuthData();
      if (!authData || !authData.athlete?.id) {
        navigate('/');
        return;
      }
      // Fetch 500 to ensure we have current and prev month for stats
      let docs = await getActivitiesFromFirebase(String(authData.athlete.id), 500, null, filterType);
      if (filterType === '') {
        docs = docs.filter(a => a.type !== 'Walk');
      }
      setActivities(docs);
      calculateStats(docs);
      if (docs && docs.length > 0) {
        setLastStartDateCursor(docs[docs.length - 1].start_date || docs[docs.length - 1].start_date_local || null);
      }
    } catch (err) {
      setError('Load failed.');
    } finally {
      setLoading(false);
    }
  };

  const [processingManualMatch, setProcessingManualMatch] = useState(false);
  const [showMatchModal, setShowMatchModal] = useState(false);
  // Map of workout.id -> { workout, activity }
  const [availableWorkoutsMap, setAvailableWorkoutsMap] = useState(new Map());

  const formatDistance = (meters) => `${(meters / 1000).toFixed(2)} km`;
  const formatDuration = (seconds) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
  };
  const formatDate = (dateString) => new Date(dateString).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });

  const loadMore = async () => {
    if (isLoadingMore || !hasMore) return;
    try {
      setIsLoadingMore(true);
      const authData = getStoredAuthData();
      if (!authData?.athlete?.id) return;
      let next = await getActivitiesFromFirebase(String(authData.athlete.id), 20, lastStartDateCursor, filterType);
      if (filterType === '') {
        next = next.filter(a => a.type !== 'Walk');
      }
      if (next && next.length > 0) {
        setActivities((prev) => prev.concat(next));
        setLastStartDateCursor(next[next.length - 1].start_date || next[next.length - 1].start_date_local || null);
        if (next.length < 20) setHasMore(false);
      } else {
        setHasMore(false);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoadingMore(false);
    }
  };

  useEffect(() => {
    loadActivitiesFromFirebase().then(() => {
      // Only sync automatically on the first load (when filter is empty)
      if (!filterType) {
        syncWithStrava(false).catch(() => { });
      }
    });
  }, [filterType]);

  useEffect(() => {
    const onScroll = () => {
      if (isLoadingMore || syncing || loading) return;
      const nearBottom = window.innerHeight + window.scrollY >= document.body.offsetHeight - 400;
      if (nearBottom && hasMore) loadMore().catch(() => { });
    };
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, [isLoadingMore, syncing, loading, hasMore, lastStartDateCursor, filterType]);

  const getActivityIcon = (type) => {
    const typeLower = type.toLowerCase();
    
    if (typeLower.includes('run')) return <IconRun size={24} />;
    if (typeLower.includes('ride') || typeLower.includes('bike') || typeLower.includes('cycle')) return <IconBike size={24} />;
    if (typeLower.includes('swim')) return <IconSwimming size={24} />;
    if (typeLower.includes('walk')) return <IconWalk size={24} />;
    if (typeLower.includes('hike') || typeLower.includes('mountain')) return <IconMountain size={24} />;
    if (typeLower.includes('workout') || typeLower.includes('weight') || typeLower.includes('strength')) return <IconBarbell size={24} />;
    
    return <IconRun size={24} />;
  };

  const groupedByMonth = activities.reduce((acc, activity) => {
    const date = new Date(activity.start_date);
    const monthKey = date.toLocaleString('default', { month: 'long', year: 'numeric' });
    if (!acc[monthKey]) acc[monthKey] = [];
    acc[monthKey].push(activity);
    return acc;
  }, {});

  return (
    <Stack gap="xl">
      <Group justify="space-between" align="center">
        <Title order={1}>Activities</Title>
        <Group>
          <Button 
            onClick={() => syncWithStrava(true)} 
            variant="light" 
            size="sm" 
            leftSection={<IconRefresh size={16} />} 
            loading={loading}
          >
            Sync with Strava
          </Button>
          <SegmentedControl
            value={filterType}
            onChange={(v) => {
              setFilterType(v);
              setActivities([]);
              setLastStartDateCursor(null);
              setHasMore(true);
            }}
            data={[
              { label: 'All', value: '' },
              { label: 'Run', value: 'Run' },
              { label: 'Ride', value: 'Ride' },
              { label: 'Swim', value: 'Swim' },
              { label: 'Walk', value: 'Walk' },
              { label: 'Hike', value: 'Hike' },
              { label: 'Workout', value: 'Workout' },
            ]}
            size="sm"
            radius="md"
          />
        </Group>
      </Group>

      {syncStatus && (
        <Paper withBorder p="xs" radius="md" bg="midnight.9">
          <Text size="sm" ta="center" fw={500} c="blue">{syncStatus}</Text>
        </Paper>
      )}

      {/* Stats Overview Section */}
      {!loading && activities.length > 0 && (
        <SimpleGrid cols={{ base: 1, sm: 2, md: 4 }} spacing="lg">
          <MetricCard
            title={`${monthlyStats.current.monthName} Activities`}
            value={String(monthlyStats.current.count)}
            description={formatTrend(monthlyStats.current.count, monthlyStats.previous.count, ' act')}
          />
          <MetricCard
            title={`${monthlyStats.current.monthName} Distance`}
            value={formatDistance(monthlyStats.current.distance).split(' ')[0]}
            unit="km"
            color="green"
            description={formatTrend(monthlyStats.current.distance, monthlyStats.previous.distance, 'km', true)}
          />
          <MetricCard
            title={`${monthlyStats.current.monthName} Time`}
            value={formatDuration(monthlyStats.current.time)}
            color="orange"
            description={formatDurationTrend(monthlyStats.current.time, monthlyStats.previous.time)}
          />
          <MetricCard
            title={`${monthlyStats.current.monthName} Elevation`}
            value={String(Math.round(monthlyStats.current.elevation))}
            unit="m"
            color="cyan"
            description={formatTrend(monthlyStats.current.elevation, monthlyStats.previous.elevation, 'm')}
          />
        </SimpleGrid>
      )}

      <Modal
        opened={syncing}
        onClose={() => { }}
        withCloseButton={false}
        centered
        title="Synchronizing Data"
        radius="md"
      >
        <Stack gap="md">
          <Progress value={progressPercent} animated />
          <Text size="sm" ta="center">Processed {processedCount} activities...</Text>
          <Text size="xs" c="dimmed" ta="center" fs="italic">{currentMessage}</Text>
        </Stack>
      </Modal>

      {loading && activities.length === 0 ? (
        <Stack gap="md">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} h={100} radius="md" />
          ))}
        </Stack>
      ) : (
        <Stack gap="xl">
          {Object.entries(groupedByMonth).map(([month, monthActivities]) => (
            <Box key={month}>
              <Title order={4} mb="md" c="dimmed" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Divider style={{ flex: 1 }} />
                {month}
                <Divider style={{ flex: 1 }} />
              </Title>
              <Stack gap="sm">
                {monthActivities.map((activity) => (
                  <Paper
                    key={activity.id}
                    className="activity-item"
                    p="md"
                    radius="md"
                    withBorder
                    onClick={() => navigate(`/activities/${activity.id}`)}
                    style={{
                      cursor: 'pointer',
                      background: 'var(--mantine-color-midnight-9)',
                      transition: 'all 0.2s ease',
                      '&:hover': {
                        borderColor: 'var(--mantine-color-blue-4)',
                        transform: 'translateX(5px)',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.2)'
                      }
                    }}
                  >
                    <Grid columns={12} gutter="md" align="center">
                      <Grid.Col span={{ base: 12, sm: 1 }}>
                        <Box 
                          p="sm" 
                          bg="rgba(33, 150, 243, 0.1)" 
                          style={{ borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }} 
                          c="blue.4"
                        >
                          {getActivityIcon(activity.type)}
                        </Box>
                      </Grid.Col>

                      <Grid.Col span={{ base: 12, sm: 4 }}>
                        <Stack gap={2}>
                          <Text fw={700} size="md" lineClamp={1}>{activity.name}</Text>
                          <Text size="xs" c="dimmed">{formatDate(activity.start_date)}</Text>
                        </Stack>
                      </Grid.Col>

                      <Grid.Col span={{ base: 12, sm: 5 }}>
                        <Group gap={rem(20)} justify="space-around" wrap="nowrap">
                          <Box style={{ minWidth: rem(60) }}>
                            <Text size="xs" c="dimmed" tt="uppercase" fw={700}>Distance</Text>
                            <Text fw={600} size="sm">{formatDistance(activity.distance)}</Text>
                          </Box>
                          <Box style={{ minWidth: rem(60) }}>
                            <Text size="xs" c="dimmed" tt="uppercase" fw={700}>Time</Text>
                            <Text fw={600} size="sm">{formatDuration(activity.moving_time)}</Text>
                          </Box>
                          {activity.average_heartrate && (
                            <Box style={{ minWidth: rem(60) }} visibleFrom="md">
                              <Text size="xs" c="dimmed" tt="uppercase" fw={700}>Avg HR</Text>
                              <Text fw={600} size="sm">{Math.round(activity.average_heartrate)} bpm</Text>
                            </Box>
                          )}
                          {(activity.weighted_average_power || activity.average_watts) && (
                            <Box style={{ minWidth: rem(60) }} visibleFrom="md">
                              <Text size="xs" c="dimmed" tt="uppercase" fw={700}>Avg Power</Text>
                              <Text fw={600} size="sm">{Math.round(activity.weighted_average_power || activity.average_watts)} W</Text>
                            </Box>
                          )}
                        </Group>
                      </Grid.Col>

                      <Grid.Col span={{ base: 12, sm: 2 }}>
                        <Box style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', minHeight: '32px' }}>
                          <Group gap="xs">
                            {activity.achievement_count > 0 && (
                              <Badge variant="light" color="yellow" size="sm" circle>
                                {activity.achievement_count}
                              </Badge>
                            )}
                            {activity.tss && (
                              <Badge variant="filled" color="blue" size="sm" radius="sm">TSS {activity.tss}</Badge>
                            )}
                          </Group>
                        </Box>
                      </Grid.Col>
                    </Grid>
                  </Paper>
                ))}
              </Stack>
            </Box>
          ))}
        </Stack>
      )}

      {error && (
        <Paper withBorder p="md" radius="md" bg="var(--mantine-color-red-light)">
          <Text c="red" ta="center">{error}</Text>
          <Group justify="center" mt="sm">
            <Button size="xs" variant="outline" color="red" onClick={loadActivities}>Retry</Button>
          </Group>
        </Paper>
      )}

      {activities.length > 0 && (
        <Group justify="center" py="xl">
          {isLoadingMore ? <Loader size="sm" /> : (hasMore ? <Text size="sm" c="dimmed">Scroll for more...</Text> : <Text size="sm" c="dimmed">All activities loaded</Text>)}
        </Group>
      )}

      <Modal
        opened={showMatchModal && availableWorkoutsMap.size > 0}
        onClose={() => setShowMatchModal(false)}
        title="Unmatched Workouts Found"
        size="lg"
        radius="lg"
      >
        <Stack gap="md">
          <Text size="sm" c="dimmed">We found Strava activities and planned workouts on the same day that didn't automatically match. Would you like to link them?</Text>

          {Array.from(availableWorkoutsMap.entries()).map(([workoutId, { workout, activities }]) => (
            <Paper key={workoutId} withBorder p="md" radius="md" bg="midnight.8">
              <Stack gap="sm">
                <Box>
                  <Text size="xs" c="dimmed" tt="uppercase" fw={700}>Planned Workout</Text>
                  <Text fw={700}>{workout.plannedActivity}</Text>
                  <Text size="xs">{workout.plannedDuration} min • {workout.date}</Text>
                  {workout.plannedDistance && <Text size="xs" c="dimmed">{workout.plannedDistance} km</Text>}
                </Box>
                
                <Divider label="Potential Matches" labelPosition="center" />
                
                {activities.map((activity, idx) => (
                  <Group key={activity.id} justify="space-between" align="flex-start" p="xs" style={{ borderRadius: '4px', background: 'rgba(255,255,255,0.03)' }}>
                    <Box>
                      <Text size="xs" c="dimmed" tt="uppercase" fw={700}>Strava Activity #{idx + 1}</Text>
                      <Text fw={700}>{activity.name}</Text>
                      <Text size="xs">{Math.round(activity.moving_time / 60)} min • {activity.type}</Text>
                      {activity.distance && <Text size="xs" c="dimmed">{(activity.distance / 1000).toFixed(2)} km</Text>}
                    </Box>
                    <Button
                      size="compact-xs"
                      variant="light"
                      color="green"
                      loading={processingManualMatch}
                      onClick={async () => {
                        setProcessingManualMatch(true);
                        try {
                          const auth = getStoredAuthData();
                          await manualLinkActivityToWorkout(String(auth.athlete.id), workoutId, activity);

                          // Remove this workout from the map
                          setAvailableWorkoutsMap(prev => {
                            const newMap = new Map(prev);
                            newMap.delete(workoutId);
                            return newMap;
                          });

                          // Auto-close modal if no more suggestions
                          if (availableWorkoutsMap.size <= 1) {
                            setShowMatchModal(false);
                          }
                        } catch (e) {
                          console.error(e);
                        } finally {
                          setProcessingManualMatch(false);
                        }
                      }}
                    >
                      Link This One
                    </Button>
                  </Group>
                ))}
              </Stack>
            </Paper>
          ))}

          <Button fullWidth variant="subtle" onClick={() => setShowMatchModal(false)}>
            Skip Remaining
          </Button>
        </Stack>
      </Modal>
    </Stack>
  );
}

export default Activities;
