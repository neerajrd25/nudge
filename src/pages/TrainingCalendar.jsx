import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';
import {
  Stack,
  Group,
  Title,
  Text,
  Button,
  Paper,
  Badge,
  rem,
  Divider,
  Box,
  SimpleGrid,
  ThemeIcon,
  Loader,
  Alert
} from '@mantine/core';
import {
  IconCalendar,
  IconRun,
  IconBike,
  IconSwimming,
  IconWalk,
  IconMountain,
  IconBarbell,
  IconBolt,
  IconArrowLeft,
  IconClock,
  IconRuler2,
  IconAward
} from '@tabler/icons-react';
import {
  getStoredAuthData,
  getAthleteActivities,
  refreshAccessToken,
  storeAuthData,
  isTokenExpired,
} from '../utils/stravaApi';

function TrainingCalendar() {
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const navigate = useNavigate();

  useEffect(() => {
    loadActivities();
  }, []);

  const activitiesByDate = useMemo(() => {
    const grouped = {};
    activities.forEach((act) => {
      const date = new Date(act.start_date).toDateString();
      if (!grouped[date]) grouped[date] = [];
      grouped[date].push(act);
    });
    return grouped;
  }, [activities]);

  const loadActivities = async () => {
    try {
      const authData = getStoredAuthData();
      if (!authData?.accessToken) {
        navigate('/');
        return;
      }
      let accessToken = authData.accessToken;
      if (isTokenExpired() && authData.refreshToken) {
        const newAuthData = await refreshAccessToken(authData.refreshToken);
        storeAuthData(newAuthData);
        accessToken = newAuthData.access_token;
      }
      const data = await getAthleteActivities(accessToken, 1, 100);
      setActivities(data);
    } catch (err) {
      setError('Failed to load training schedule.');
    } finally {
      setLoading(false);
    }
  };

  const getSportIcon = (type) => {
    const icons = { Run: IconRun, Ride: IconBike, Swim: IconSwimming, Walk: IconWalk, Hike: IconMountain, Workout: IconBarbell };
    const Icon = icons[type] || IconBolt;
    return <Icon size={20} />;
  };

  const selectedActivities = activitiesByDate[selectedDate.toDateString()] || [];

  if (loading) return <Stack align="center" py={rem(100)}><Loader size="xl" /><Text c="dimmed">Loading training logs...</Text></Stack>;

  return (
    <Stack gap="xl">
      <Group justify="space-between">
        <Title order={1}>Training Calendar</Title>
        <Button variant="subtle" leftSection={<IconArrowLeft size={16} />} onClick={() => navigate('/')}>Dashboard</Button>
      </Group>

      {error && <Alert color="red" title="Sync Status">{error}</Alert>}

      <SimpleGrid cols={{ base: 1, md: 2 }} spacing="xl">
        <Paper withBorder p="xl" radius="lg" bg="midnight.9">
          <Calendar
            onChange={setSelectedDate}
            value={selectedDate}
            tileClassName={({ date, view }) => (view === 'month' && activitiesByDate[date.toDateString()] ? 'has-activities' : null)}
            className="custom-intelligence-calendar"
            calendarType="ISO 8601"
            locale="en-GB"
          />
          <Group mt="lg" gap="xs">
            <Box w={8} h={8} bg="blue.6" style={{ borderRadius: '50%' }} />
            <Text size="xs" c="dimmed">Days with activity data</Text>
          </Group>
        </Paper>

        <Stack gap="lg">
          <Paper withBorder p="lg" radius="lg" bg="midnight.9">
            <Stack gap="md">
              <Group justify="space-between">
                <Title order={3} size="h4">{selectedDate.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</Title>
                <Badge variant="light" color="blue">{selectedActivities.length} Activities</Badge>
              </Group>

              {selectedActivities.length === 0 ? (
                <Stack align="center" py="xl" c="dimmed">
                  <IconCalendar size={48} opacity={0.2} />
                  <Text size="sm">No training recorded for this day.</Text>
                </Stack>
              ) : (
                <Stack gap="sm">
                  {selectedActivities.map((act) => (
                    <Paper key={act.id} withBorder p="sm" radius="md" bg="midnight.8" style={{ borderLeft: '3px solid var(--mantine-color-blue-6)' }}>
                      <Group justify="space-between" mb={8}>
                        <Group gap="xs">
                          <Box c="blue.4">{getSportIcon(act.type)}</Box>
                          <Text fw={800} size="sm">{act.name}</Text>
                        </Group>
                        <Badge size="xs" variant="light">{act.type}</Badge>
                      </Group>
                      <Group gap="lg">
                        <Group gap={4}><IconRuler2 size={12} color="dimmed" /><Text size="xs" c="dimmed">{(act.distance / 1000).toFixed(2)} km</Text></Group>
                        <Group gap={4}><IconClock size={12} color="dimmed" /><Text size="xs" c="dimmed">{Math.floor(act.moving_time / 60)}m {act.moving_time % 60}s</Text></Group>
                      </Group>
                    </Paper>
                  ))}
                </Stack>
              )}
            </Stack>
          </Paper>

          {selectedActivities.length > 0 && (
            <Paper withBorder p="lg" radius="lg" bg="midnight.9" style={{ position: 'relative', overflow: 'hidden' }}>
              <Title order={4} mb="md">Daily Intelligence</Title>
              <SimpleGrid cols={2}>
                <Stack gap={0}>
                  <Text size="xs" c="dimmed" fw={900} tt="uppercase">Training Load</Text>
                  <Text size="xl" fw={900} c="blue">
                    {selectedActivities.reduce((sum, a) => sum + (a.tss || 0), 0)} TSS
                  </Text>
                </Stack>
                <Stack gap={0}>
                  <Text size="xs" c="dimmed" fw={900} tt="uppercase">Total Volume</Text>
                  <Text size="xl" fw={900}>
                    {Math.round(selectedActivities.reduce((sum, a) => sum + a.moving_time, 0) / 60)} min
                  </Text>
                </Stack>
              </SimpleGrid>
              <IconAward size={80} style={{ position: 'absolute', right: rem(-15), bottom: rem(-15), opacity: 0.05, color: 'var(--mantine-color-blue-6)' }} />
            </Paper>
          )}
        </Stack>
      </SimpleGrid>
    </Stack>
  );
}

export default TrainingCalendar;
