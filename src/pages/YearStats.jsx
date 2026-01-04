import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Stack,
  Group,
  Title,
  Text,
  Button,
  Select,
  Card,
  SimpleGrid,
  Paper,
  Box,
  rem,
  Loader,
  Divider,
  ThemeIcon,
  Badge,
} from '@mantine/core';
import {
  IconCalendar,
  IconActivity,
  IconRuler2,
  IconClock,
  IconMountain,
  IconTrophy,
  IconChartBar,
  IconRun,
  IconBike,
  IconSwimming,
  IconWalk,
  IconBarbell,
  IconBolt
} from '@tabler/icons-react';
import { getStoredAuthData } from '../utils/stravaApi';
import { getYearStatsFromFirebase } from '../utils/firebaseService';

const YearStats = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [yearStats, setYearStats] = useState(null);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const navigate = useNavigate();

  useEffect(() => {
    const fetchYearStats = async () => {
      try {
        setLoading(true);
        setError(null);
        const authData = getStoredAuthData();
        if (!authData?.athlete) {
          setError('Not authenticated. Please login with Strava.');
          return;
        }
        const stats = await getYearStatsFromFirebase(String(authData.athlete.id), selectedYear);
        setYearStats(stats);
      } catch (err) {
        setError(err.message || 'Failed to load year statistics');
      } finally {
        setLoading(false);
      }
    };
    fetchYearStats();
  }, [selectedYear]);

  const formatDistance = (m) => ((m || 0) / 1000).toLocaleString(undefined, { maximumFractionDigits: 1 });
  const formatTime = (s) => {
    const h = Math.floor((s || 0) / 3600);
    const m = Math.floor(((s || 0) % 3600) / 60);
    return `${h}h ${m}m`;
  };
  const formatElevation = (m) => (m || 0).toLocaleString(undefined, { maximumFractionDigits: 0 });

  const availableYears = useMemo(() => {
    const current = new Date().getFullYear();
    return Array.from({ length: 6 }, (_, i) => ({
      value: (current - i).toString(),
      label: (current - i).toString()
    }));
  }, []);

  const getSportIcon = (type) => {
    const icons = { Run: IconRun, Ride: IconBike, Swim: IconSwimming, Walk: IconWalk, Hike: IconMountain, Workout: IconBarbell };
    const Icon = icons[type] || IconBolt;
    return <Icon size={20} />;
  };

  if (loading) return <Stack align="center" py={rem(100)}><Loader size="xl" /><Text c="dimmed">Analyzing your year...</Text></Stack>;
  if (error) return (
    <Paper withBorder p="xl" radius="md" bg="red.9" c="white">
      <Stack align="center">
        <Text>{error}</Text>
        <Button variant="white" color="red" onClick={() => navigate('/')}>Dashboard</Button>
      </Stack>
    </Paper>
  );

  return (
    <Stack gap="xl">
      <Group justify="space-between" align="center">
        <Stack gap={0}>
          <Title order={1}>Year Analytics</Title>
          <Text c="dimmed">Performance review for {selectedYear}</Text>
        </Stack>
        <Select
          data={availableYears}
          value={selectedYear.toString()}
          onChange={(v) => setSelectedYear(Number(v))}
          style={{ width: rem(105) }}
          leftSection={<IconCalendar size={16} />}
        />
      </Group>

      {yearStats && (
        <Stack gap="xl">
          <Box>
            <Title order={3} mb="lg">Annual Summary</Title>
            <SimpleGrid cols={{ base: 1, sm: 2, md: 4 }} spacing="lg">
              {[
                { label: 'Activities', value: yearStats.summary.totalActivities, icon: IconActivity, color: 'blue' },
                { label: 'Distance', value: `${formatDistance(yearStats.summary.totalDistance)} km`, icon: IconRuler2, color: 'cyan' },
                { label: 'Moving Time', value: formatTime(yearStats.summary.totalMovingTime), icon: IconClock, color: 'teal' },
                { label: 'Elevation', value: `${formatElevation(yearStats.summary.totalElevation)} m`, icon: IconMountain, color: 'indigo' },
              ].map((stat) => (
                <Paper key={stat.label} withBorder p="lg" radius="lg" bg="midnight.9">
                  <ThemeIcon variant="light" color={stat.color} mb="xs"><stat.icon size={18} /></ThemeIcon>
                  <Text size="xs" tt="uppercase" fw={900} c="dimmed">{stat.label}</Text>
                  <Text size="xl" fw={900}>{stat.value}</Text>
                </Paper>
              ))}
            </SimpleGrid>
          </Box>

          <Box>
            <Title order={3} mb="lg">By Activity Type</Title>
            <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }} spacing="lg">
              {Object.entries(yearStats.byType || {}).map(([type, stats]) => (
                <Card key={type} p="lg" radius="lg" withBorder bg="midnight.9">
                  <Group mb="md" justify="space-between">
                    <Group gap="xs">
                      <Box c="blue.4">{getSportIcon(type)}</Box>
                      <Title order={4} size="h5">{type}</Title>
                    </Group>
                    <Badge variant="light" color="blue">{stats.count || 0}</Badge>
                  </Group>
                  <Stack gap="xs">
                    <Group justify="space-between"><Text size="xs" fw={700} c="dimmed">Distance</Text><Text fw={900}>{formatDistance(stats.distance)} km</Text></Group>
                    <Group justify="space-between"><Text size="xs" fw={700} c="dimmed">Time</Text><Text fw={900}>{formatTime(stats.movingTime)}</Text></Group>
                    <Group justify="space-between"><Text size="xs" fw={700} c="dimmed">Elevation</Text><Text fw={900}>{formatElevation(stats.elevation)} m</Text></Group>
                  </Stack>
                </Card>
              ))}
            </SimpleGrid>
          </Box>

          <Box>
            <Title order={3} mb="lg">Monthly Distribution</Title>
            <SimpleGrid cols={{ base: 2, sm: 3, md: 4, lg: 6 }} spacing="sm">
              {Object.entries(yearStats.byMonth || {}).map(([month, stats]) => (
                <Paper key={month} withBorder p="sm" radius="md" ta="center" bg="midnight.9">
                  <Text fw={900} size="xs" tt="uppercase" c="blue.4">{month}</Text>
                  <Divider my={4} opacity={0.05} />
                  <Text size="sm" fw={900}>{stats.count || 0} act.</Text>
                  <Text size="10px" c="dimmed">{formatDistance(stats.distance)} km</Text>
                </Paper>
              ))}
            </SimpleGrid>
          </Box>

          {yearStats.biggestDay && (
            <Paper withBorder p="xl" radius="lg" bg="midnight.9" style={{ borderLeft: '4px solid var(--mantine-color-blue-6)' }}>
              <Group align="center" justify="space-between">
                <Stack gap="xs">
                  <Group gap="xs">
                    <IconTrophy size={24} color="var(--mantine-color-yellow-4)" />
                    <Title order={3}>Biggest Training Day</Title>
                  </Group>
                  <Text size="lg" fw={900} c="blue">{new Date(yearStats.biggestDay.date).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}</Text>
                </Stack>
                <Group gap="xl">
                  <Box ta="center">
                    <Text size="xs" tt="uppercase" fw={900} c="dimmed">Distance</Text>
                    <Text size="xl" fw={900}>{formatDistance(yearStats.biggestDay.distance)} km</Text>
                  </Box>
                  <Box ta="center">
                    <Text size="xs" tt="uppercase" fw={900} c="dimmed">Volume</Text>
                    <Text size="xl" fw={900}>{yearStats.biggestDay.count} Acts</Text>
                  </Box>
                </Group>
              </Group>
            </Paper>
          )}
        </Stack>
      )}
    </Stack>
  );
};

export default YearStats;
