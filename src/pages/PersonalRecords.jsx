import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Stack,
  Group,
  Title,
  Text,
  Paper,
  SimpleGrid,
  ThemeIcon,
  rem,
  Box,
  Loader,
  Alert,
  Divider,
  Badge
} from '@mantine/core';
import {
  IconTrophy,
  IconRuler2,
  IconClock,
  IconMountain,
  IconBike,
  IconRun,
  IconSwimming,
  IconWalk,
  IconBarbell,
  IconChartBar,
  IconCircleCheck
} from '@tabler/icons-react';
import { getStoredAuthData, refreshAccessToken, storeAuthData, isTokenExpired, getAthleteStats } from '../utils/stravaApi';
import { getStravaStatsFromFirebase, storeStravaStatsInFirebase } from '../utils/firebaseService';

function PersonalRecords() {
  const EMPTY_STATS = {
    all_ride_totals: { distance: 0, moving_time: 0, elevation_gain: 0, count: 0, max_distance: 0 },
    all_run_totals: { distance: 0, moving_time: 0, elevation_gain: 0, count: 0, max_distance: 0 },
    all_swim_totals: { distance: 0, moving_time: 0, elevation_gain: 0, count: 0, max_distance: 0 },
  };

  const [athleteStats, setAthleteStats] = useState(EMPTY_STATS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const authData = getStoredAuthData();
      if (!authData?.athlete) {
        navigate('/');
        return;
      }

      let accessToken = authData.accessToken;
      if (isTokenExpired() && authData.refreshToken) {
        const newAuthData = await refreshAccessToken(authData.refreshToken);
        storeAuthData(newAuthData);
        accessToken = newAuthData.access_token;
      }

      let stats = await getStravaStatsFromFirebase(authData.athlete.id);
      if (!stats) {
        stats = await getAthleteStats(accessToken, authData.athlete.id);
        await storeStravaStatsInFirebase(authData.athlete.id, stats);
      }
      setAthleteStats(stats || EMPTY_STATS);
    } catch (err) {
      setError('Failed to load fitness stats.');
    } finally {
      setLoading(false);
    }
  };

  const formatKm = (meters) => (meters / 1000).toLocaleString(undefined, { maximumFractionDigits: 1 }) + ' km';
  const formatHours = (seconds) => (seconds / 3600).toLocaleString(undefined, { maximumFractionDigits: 1 }) + ' hrs';

  if (loading) return <Stack align="center" py={rem(100)}><Loader size="xl" /><Text c="dimmed">Analyzing achievements...</Text></Stack>;
  if (error) return <Alert color="red" title="Error" mt="xl">{error}</Alert>;

  const summaryStats = [
    { label: 'Total Distance', value: formatKm((athleteStats.all_ride_totals?.distance || 0) + (athleteStats.all_run_totals?.distance || 0) + (athleteStats.all_swim_totals?.distance || 0)), icon: IconRuler2, color: 'blue' },
    { label: 'Moving Time', value: formatHours((athleteStats.all_ride_totals?.moving_time || 0) + (athleteStats.all_run_totals?.moving_time || 0) + (athleteStats.all_swim_totals?.moving_time || 0)), icon: IconClock, color: 'cyan' },
    { label: 'Total Elevation', value: Math.round((athleteStats.all_ride_totals?.elevation_gain || 0) + (athleteStats.all_run_totals?.elevation_gain || 0)).toLocaleString() + ' m', icon: IconMountain, color: 'teal' },
  ];

  const sports = [
    { label: 'Cycling', stats: athleteStats.all_ride_totals, icon: IconBike, color: 'blue' },
    { label: 'Running', stats: athleteStats.all_run_totals, icon: IconRun, color: 'green' },
    { label: 'Swimming', stats: athleteStats.all_swim_totals, icon: IconSwimming, color: 'cyan' },
  ].filter(s => s.stats && s.stats.count > 0);

  return (
    <Stack gap="xl">
      <Stack gap={0}>
        <Title order={1}>Fitness Dashboard</Title>
        <Text c="dimmed">Personal records, trends, and all-time achievements</Text>
      </Stack>

      <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="lg">
        {summaryStats.map((stat) => (
          <Paper key={stat.label} withBorder p="xl" radius="lg" bg="midnight.9">
            <Group>
              <ThemeIcon size="xl" radius="md" variant="light" color={stat.color}>
                <stat.icon size={24} />
              </ThemeIcon>
              <div>
                <Text size="xs" c="dimmed" fw={900} tt="uppercase">{stat.label}</Text>
                <Text size="xl" fw={900}>{stat.value}</Text>
              </div>
            </Group>
          </Paper>
        ))}
      </SimpleGrid>

      <Title order={3} mt="md">Sport Breakdown</Title>
      <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="lg">
        {sports.map((sport) => (
          <Paper key={sport.label} withBorder p="lg" radius="lg" bg="midnight.9">
            <Stack>
              <Group justify="space-between">
                <ThemeIcon size="lg" radius="md" variant="filled" color={sport.color}>
                  <sport.icon size={20} />
                </ThemeIcon>
                <Badge variant="light" color={sport.color}>{sport.stats.count} Activities</Badge>
              </Group>
              <div>
                <Text fw={900} size="lg">{sport.label}</Text>
                <Text size="xl" fw={900} c={sport.color}>{formatKm(sport.stats.distance)}</Text>
                <Text size="xs" c="dimmed" fw={700}>Longest: {formatKm(sport.stats.max_distance)}</Text>
              </div>
            </Stack>
          </Paper>
        ))}
      </SimpleGrid>

      <Title order={3} mt="md">Brag Stats</Title>
      <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }} spacing="lg">
        {athleteStats.all_ride_totals?.distance > 0 && (
          <Paper withBorder p="lg" radius="lg" bg="midnight.9" style={{ borderLeft: '4px solid var(--mantine-color-blue-6)' }}>
            <Group mb="xs"><IconCircleCheck size={18} color="var(--mantine-color-blue-6)" /><Text fw={800} size="sm">Global Traveler</Text></Group>
            <Text size="sm" mb="xs">You've cycled {formatKm(athleteStats.all_ride_totals.distance)}</Text>
            <Text size="xs" c="dimmed" fs="italic">≈ {Math.round(athleteStats.all_ride_totals.distance / 1000 / 40075 * 100) / 100} circumnavigations of Earth</Text>
          </Paper>
        )}
        {athleteStats.all_run_totals?.distance > 0 && (
          <Paper withBorder p="lg" radius="lg" bg="midnight.9" style={{ borderLeft: '4px solid var(--mantine-color-green-6)' }}>
            <Group mb="xs"><IconCircleCheck size={18} color="var(--mantine-color-green-6)" /><Text fw={800} size="sm">Marathon Specialist</Text></Group>
            <Text size="sm" mb="xs">You've run {formatKm(athleteStats.all_run_totals.distance)}</Text>
            <Text size="xs" c="dimmed" fs="italic">≈ {Math.round(athleteStats.all_run_totals.distance / 1000 / 42.195)} full marathons completed</Text>
          </Paper>
        )}
        {(athleteStats.all_ride_totals?.elevation_gain || 0) + (athleteStats.all_run_totals?.elevation_gain || 0) > 0 && (
          <Paper withBorder p="lg" radius="lg" bg="midnight.9" style={{ borderLeft: '4px solid var(--mantine-color-teal-6)' }}>
            <Group mb="xs"><IconCircleCheck size={18} color="var(--mantine-color-teal-6)" /><Text fw={800} size="sm">Mountain Goat</Text></Group>
            <Text size="sm" mb="xs">Total climb: {Math.round((athleteStats.all_ride_totals?.elevation_gain || 0) + (athleteStats.all_run_totals?.elevation_gain || 0)).toLocaleString()} m</Text>
            <Text size="xs" c="dimmed" fs="italic">≈ {Math.round(((athleteStats.all_ride_totals?.elevation_gain || 0) + (athleteStats.all_run_totals?.elevation_gain || 0)) / 8848 * 10) / 10} Mt. Everests conquered</Text>
          </Paper>
        )}
      </SimpleGrid>
    </Stack>
  );
}

export default PersonalRecords;
