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
  const navigate = useNavigate();

  const loadActivities = async () => {
    setLoading(true);
    try {
      const authData = getStoredAuthData();
      if (!authData || !authData.accessToken) {
        navigate('/');
        return;
      }
      let accessToken = authData.accessToken;
      if (isTokenExpired() && authData.refreshToken) {
        const newAuthData = await refreshAccessToken(authData.refreshToken);
        storeAuthData(newAuthData);
        accessToken = newAuthData.access_token;
      }
      setSyncStatus('Fetching activities from Strava...');
      const data = await getAllAthleteActivities(accessToken);
      setActivities(data);

      const athleteId = String(authData.athlete.id);
      const matches = await autoMatchActivities(athleteId, data);

      let statusMsg = `✓ Activities loaded.`;
      if (matches.matched && matches.matched.length > 0) statusMsg += ` ${matches.matched.length} matched.`;
      if (matches.potential && matches.potential.length > 0) {
        // Build map: workout.id -> [{ workout, activities: [...] }]
        const workoutMap = new Map();
        matches.potential.forEach(({ activity, potentialWorkouts }) => {
          potentialWorkouts.forEach(workout => {
            if (!workoutMap.has(workout.id)) {
              workoutMap.set(workout.id, { workout, activities: [] });
            }
            workoutMap.get(workout.id).activities.push(activity);
          });
        });
        setAvailableWorkoutsMap(workoutMap);
        setShowMatchModal(true);
        statusMsg += ` ${workoutMap.size} suggestions.`;
      }
      setSyncStatus(statusMsg);
      setTimeout(() => setSyncStatus(null), 2000);
    } catch (err) {
      setError('Failed to load activities.');
      setSyncStatus(null);
    } finally {
      setLoading(false);
    }
  };

  const [processingManualMatch, setProcessingManualMatch] = useState(false);
  const [showMatchModal, setShowMatchModal] = useState(false);
  // Map of workout.id -> { workout, activity }
  const [availableWorkoutsMap, setAvailableWorkoutsMap] = useState(new Map());

  const autoSyncOnMount = async () => {
    try {
      const authData = getStoredAuthData();
      if (!authData || !authData.accessToken) return;
      const athleteId = String(authData.athlete.id);

      // Background Fetch Settings
      const [userSettings, existing] = await Promise.all([
        getAthleteSettings(athleteId),
        getActivitiesFromFirebase(athleteId, 1, null, filterType)
      ]);

      let accessToken = authData.accessToken;
      if (isTokenExpired() && authData.refreshToken) {
        setSyncStatus('Refreshing Strava token...');
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

      setSyncing(true);
      const perPage = 200;
      let page = 1;
      let anyStored = 0;
      const allPotential = [];
      const allMatched = [];

      const messages = ['Keep going!', 'Consistency is key.', 'Finish strong!', 'Habit is everything.'];
      let msgIdx = 0;

      const msgInterval = setInterval(() => {
        msgIdx = (msgIdx + 1) % messages.length;
        setCurrentMessage(messages[msgIdx]);
      }, 4000);

      while (true) {
        setCurrentPageIdx(page);
        const pageActivities = await getAthleteActivities(accessToken, page, perPage, afterSec);
        if (!pageActivities || pageActivities.length === 0) break;

        const res = await storeActivitiesInFirebase(athleteId, pageActivities, userSettings);
        anyStored += (res && res.count) ? res.count : pageActivities.length;
        const matches = await autoMatchActivities(athleteId, pageActivities);
        if (matches.matched && matches.matched.length > 0) allMatched.push(...matches.matched);
        if (matches.potential && matches.potential.length > 0) allPotential.push(...matches.potential);

        setProcessedCount(anyStored);
        setProgressPercent(Math.min(95, page * 5));
        if (pageActivities.length < perPage) break;
        page += 1;
      }

      if (allPotential.length > 0) {
        // Build map: workout.id -> { workout, activities: [...] }
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

      let statusMsg = `✓ Stored ${anyStored} new activities.`;
      if (allMatched.length > 0) statusMsg += ` ${allMatched.length} matched to plan.`;
      setSyncStatus(statusMsg);

      clearInterval(msgInterval);
      setProgressPercent(100);
      if (anyStored > 0) {
        const refreshed = await getActivitiesFromFirebase(athleteId, displayLimit, null, filterType);
        setActivities(refreshed);
        if (refreshed && refreshed.length > 0) {
          setLastStartDateCursor(refreshed[refreshed.length - 1].start_date || refreshed[refreshed.length - 1].start_date_local || null);
        }
      } else {
        setSyncStatus(null);
      }
    } catch (err) {
      console.error('Auto-sync background error:', err);
      setSyncStatus('Auto-sync failed');
    } finally {
      setSyncing(false);
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
      const docs = await getActivitiesFromFirebase(String(authData.athlete.id), displayLimit, null, filterType);
      setActivities(docs);
      setSyncStatus(`Loaded ${docs.length} activities`);
    } catch (err) {
      setError('Load failed.');
    } finally {
      setLoading(false);
      setTimeout(() => setSyncStatus(null), 2000);
    }
  };

  const handleSyncToFirebase = async () => {
    try {
      const authData = getStoredAuthData();
      if (!authData?.athlete?.id) return;
      setLoading(true);
      const athleteId = String(authData.athlete.id);
      const userSettings = await getAthleteSettings(athleteId);
      const result = await storeActivitiesInFirebase(athleteId, activities, userSettings);
      const matches = await autoMatchActivities(athleteId, activities);

      let statusMsg = `✓ Cloud Push Complete.`;
      if (matches.matched && matches.matched.length > 0) statusMsg += ` ${matches.matched.length} matched.`;
      if (matches.potential && matches.potential.length > 0) {
        // Build map: workout.id -> { workout, activities: [...] }
        const workoutMap = new Map();
        matches.potential.forEach(({ activity, potentialWorkouts }) => {
          potentialWorkouts.forEach(workout => {
            if (!workoutMap.has(workout.id)) {
              workoutMap.set(workout.id, { workout, activities: [] });
            }
            workoutMap.get(workout.id).activities.push(activity);
          });
        });
        setAvailableWorkoutsMap(workoutMap);
        setShowMatchModal(true);
        statusMsg += ` ${workoutMap.size} suggestions.`;
      }
      setSyncStatus(statusMsg);
    } catch (e) {
      setSyncStatus('Sync failed');
    } finally {
      setLoading(false);
      setTimeout(() => setSyncStatus(null), 3000);
    }
  };

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
      const next = await getActivitiesFromFirebase(String(authData.athlete.id), 20, lastStartDateCursor, filterType);
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
      autoSyncOnMount().catch(() => { });
    });
  }, []);

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
    const icons = {
      Run: <IconRun size={24} />,
      Ride: <IconBike size={24} />,
      Swim: <IconSwimming size={24} />,
      Walk: <IconWalk size={24} />,
      Hike: <IconMountain size={24} />,
      Workout: <IconBarbell size={24} />
    };
    return icons[type] || <IconRun size={24} />;
  };

  return (
    <Stack gap="xl">
      <Group justify="space-between" align="center">
        <Title order={1}>Activities</Title>
        <Group>
          <Button onClick={loadActivities} variant="subtle" size="sm" leftSection={<IconRefresh size={16} />} loading={loading}>Sync Strava</Button>
          <Button onClick={handleSyncToFirebase} variant="light" size="sm" leftSection={<IconCloudUpload size={16} />}>Cloud Push</Button>
          <Select
            placeholder="Type"
            data={['Run', 'Ride', 'Swim', 'Walk', 'Hike', 'Workout']}
            value={filterType}
            leftSection={<IconFilter size={14} />}
            onChange={(v) => {
              setFilterType(v);
              setActivities([]);
              setLastStartDateCursor(null);
              setHasMore(true);
              setLoading(true);
            }}
            clearable
            style={{ width: rem(130) }}
          />
        </Group>
      </Group>

      {syncStatus && (
        <Paper withBorder p="xs" radius="md" bg="midnight.9">
          <Text size="sm" ta="center" fw={500} c="blue">{syncStatus}</Text>
        </Paper>
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
        <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }} spacing="lg">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} h={180} radius="md" />
          ))}
        </SimpleGrid>
      ) : (
        <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }} spacing="lg">
          {activities.map((activity) => (
            <Card
              key={activity.id}
              className="activity-card"
              padding="lg"
              radius="lg"
              withBorder
              onClick={() => navigate(`/activities/${activity.id}`)}
              style={{
                cursor: 'pointer',
                background: 'var(--mantine-color-midnight-9)',
                transition: 'transform 0.2s ease, border-color 0.2s ease'
              }}
            >
              <Group justify="space-between" mb="md">
                <Box c="blue.4">
                  {getActivityIcon(activity.type)}
                </Box>
                <Tooltip label={activity.start_date_local || activity.start_date}>
                  <Text size="xs" c="dimmed" fw={700}>{formatDate(activity.start_date)}</Text>
                </Tooltip>
              </Group>

              <Text fw={900} mb="xs" lineClamp={1} size="lg">{activity.name}</Text>

              <SimpleGrid cols={2} gap="sm" mb="md">
                <Box>
                  <Text size="xs" c="dimmed" tt="uppercase" fw={700}>Distance</Text>
                  <Text fw={600}>{formatDistance(activity.distance)}</Text>
                </Box>
                <Box>
                  <Text size="xs" c="dimmed" tt="uppercase" fw={700}>Time</Text>
                  <Text fw={600}>{formatDuration(activity.moving_time)}</Text>
                </Box>
              </SimpleGrid>

              <Group gap="xs">
                {activity.total_elevation_gain > 0 && (
                  <Badge variant="light" color="green" size="sm" leftSection={<IconMountain size={12} />}>
                    {Math.round(activity.total_elevation_gain)}m
                  </Badge>
                )}
                {activity.achievement_count > 0 && (
                  <Badge variant="light" color="yellow" size="sm" leftSection={<IconTrophy size={12} />}>
                    {activity.achievement_count}
                  </Badge>
                )}
                {activity.tss && (
                  <Badge variant="filled" color="blue" size="sm" fw={900}>TSS {activity.tss}</Badge>
                )}
              </Group>
            </Card>
          ))}
        </SimpleGrid>
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
