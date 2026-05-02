import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Container,
  Stack,
  Group,
  Title,
  Text,
  Button,
  Paper,
  SimpleGrid,
  Badge,
  rem,
  Divider,
  Box,
  Loader,
  Alert
} from '@mantine/core';
import {
  IconRun,
  IconBike,
  IconSwimming,
  IconWalk,
  IconMountain,
  IconBarbell,
  IconClock,
  IconMapPin,
  IconHeartRateMonitor,
  IconTrophy,
  IconArrowLeft,
  IconExternalLink,
  IconRefresh,
  IconBolt,
  IconChartBar,
  IconTrash
} from '@tabler/icons-react';
import { getActivityFromFirebase, getAthleteSettings, deleteActivityFromFirebase } from '../utils/firebaseService';
import { getStoredAuthData, isTokenExpired, refreshAccessToken, storeAuthData, getActivityById } from '../utils/stravaApi';
import { calculateTSS } from '../utils/metrics';
import { MapContainer, TileLayer, Polyline, CircleMarker, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

function FitBounds({ positions }) {
  const map = useMap();
  useEffect(() => {
    if (!map || !positions || positions.length === 0) return;
    map.fitBounds(positions, { padding: [20, 20] });
  }, [map, positions]);
  return null;
}

const formatDistance = (m) => (m == null ? '-' : `${(m / 1000).toFixed(2)} km`);
const formatTime = (s) => {
  if (s == null) return '-';
  const hrs = Math.floor(s / 3600);
  const mins = Math.floor((s % 3600) / 60);
  const secs = Math.floor(s % 60);
  return [hrs, mins, secs].map((n) => n.toString().padStart(2, '0')).join(':');
};
const formatSpeedKMH = (mps) => (mps == null ? '-' : `${(mps * 3.6).toFixed(2)} km/h`);

const decodePolyline = (str, precision = 5) => {
  if (!str || typeof str !== 'string') return [];
  let index = 0, lat = 0, lng = 0, coordinates = [];
  const factor = Math.pow(10, precision || 5);
  while (index < str.length) {
    let result = 0, shift = 0, byte = null;
    do { byte = str.charCodeAt(index++) - 63; result |= (byte & 0x1f) << shift; shift += 5; } while (byte >= 0x20);
    lat += (result & 1) ? ~(result >> 1) : (result >> 1);
    result = 0; shift = 0;
    do { byte = str.charCodeAt(index++) - 63; result |= (byte & 0x1f) << shift; shift += 5; } while (byte >= 0x20);
    lng += (result & 1) ? ~(result >> 1) : (result >> 1);
    coordinates.push([lat / factor, lng / factor]);
  }
  return coordinates;
};

export default function ActivityDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [activity, setActivity] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [settings, setSettings] = useState(null);
  const [fetchingStrava, setFetchingStrava] = useState(false);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const auth = getStoredAuthData();
        if (!auth?.athlete) {
          setError('Strava connection required.');
          return;
        }
        const [doc, userSettings] = await Promise.all([
          getActivityFromFirebase(String(auth.athlete.id), id),
          getAthleteSettings(String(auth.athlete.id))
        ]);
        if (userSettings) setSettings(userSettings);
        if (doc) setActivity(doc);
        else setError('Not found in local IQ storage. Fetch from Strava below.');
      } catch (err) { setError('Error loading activity detail.'); }
      finally { setLoading(false); }
    };
    load();
  }, [id]);

  const handleFetchFromStrava = async () => {
    setFetchingStrava(true);
    try {
      let auth = getStoredAuthData();
      let accessToken = auth.accessToken;
      if (isTokenExpired()) {
        const refreshed = await refreshAccessToken(auth.refreshToken);
        storeAuthData(refreshed);
        accessToken = refreshed.access_token;
      }
      const stravaAct = await getActivityById(accessToken, id);
      setActivity(stravaAct);
      setError(null);
    } catch (err) { setError('Failed to pull from Strava.'); }
    finally { setFetchingStrava(false); }
  };

  const handleDelete = async () => {
    if (!window.confirm('Are you sure you want to delete this activity from your local IQ storage? This will not affect Strava.')) return;
    try {
      const auth = getStoredAuthData();
      if (!auth?.athlete) return;
      await deleteActivityFromFirebase(String(auth.athlete.id), id);
      navigate('/activities');
    } catch (err) {
      setError('Failed to delete activity.');
    }
  };

  if (loading) return <Stack align="center" py={rem(100)}><Loader size="xl" /><Text c="dimmed">Fetching intelligence...</Text></Stack>;

  const getActivityIcon = (type) => {
    const icons = { Run: IconRun, Ride: IconBike, Swim: IconSwimming, Walk: IconWalk, Hike: IconMountain, Workout: IconBarbell };
    const Icon = icons[type] || IconBolt;
    return <Icon size={32} />;
  };

  const mapCoords = activity?.map?.summary_polyline ? decodePolyline(activity.map.summary_polyline) : [];
  const activityDate = new Date(activity?.start_date || activity?.start_date_local || '');

  // Calculate TSS if missing (legacy sync or Strava direct fetch)
  const displayTSS = activity?.tss || (activity ? calculateTSS(activity, settings) : 0);
  const fatigueImpact = Math.round(displayTSS / 7);
  const fitnessImpact = Math.round(displayTSS / 42);

  return (
    <Stack gap="xl">
      <Group justify="space-between">
        <Button variant="subtle" leftSection={<IconArrowLeft size={16} />} onClick={() => navigate('/activities')}>Back</Button>
        <Group>
          <Button variant="light" size="sm" color="blue" leftSection={<IconRefresh size={16} />} onClick={handleFetchFromStrava} loading={fetchingStrava}>
            Deep Refresh
          </Button>
          <Button component="a" href={`https://www.strava.com/activities/${id}`} target="_blank" variant="subtle" size="sm" rightSection={<IconExternalLink size={16} />}>
            Strava
          </Button>
          <Button variant="light" color="red" size="sm" leftSection={<IconTrash size={16} />} onClick={handleDelete}>
            Delete
          </Button>
        </Group>
      </Group>

      {error && <Alert icon={<IconBolt size={16} />} title="Sync Status" color="orange" variant="light">{error}</Alert>}

      {activity && (
        <>
          <Paper withBorder p="xl" radius="lg" bg="midnight.9">
            <Group align="flex-start" justify="space-between" mb="xl">
              <Stack gap={4}>
                <Group gap="xs">
                  <Box c="blue.4">{getActivityIcon(activity.type)}</Box>
                  <Title order={1}>{activity.name}</Title>
                </Group>
                <Text c="dimmed" fw={700}>{activityDate.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</Text>
              </Stack>
              <Badge size="xl" variant="filled" color="blue" radius="md">
                Load: {displayTSS || 'N/A'}
              </Badge>
            </Group>

            <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="xl">
              <Stack gap={4}>
                <Text size="xs" c="dimmed" fw={900} tt="uppercase">Distance</Text>
                <Text size="xl" fw={900}>{formatDistance(activity.distance)}</Text>
              </Stack>
              <Stack gap={4}>
                <Text size="xs" c="dimmed" fw={900} tt="uppercase">Moving Time</Text>
                <Text size="xl" fw={900}>{formatTime(activity.moving_time)}</Text>
              </Stack>
              <Stack gap={4}>
                <Text size="xs" c="dimmed" fw={900} tt="uppercase">Avg Heart Rate</Text>
                <Text size="xl" fw={900}>{activity.average_heartrate ? `${Math.round(activity.average_heartrate)} bpm` : '-'}</Text>
              </Stack>
              <Stack gap={4}>
                <Text size="xs" c="dimmed" fw={900} tt="uppercase">Elevation</Text>
                <Text size="xl" fw={900}>{activity.total_elevation_gain ? `${Math.round(activity.total_elevation_gain)}m` : '-'}</Text>
              </Stack>
            </SimpleGrid>
          </Paper>

          <SimpleGrid cols={{ base: 1, md: 2 }} spacing="xl">
            <Stack gap="xl">
              <Paper withBorder p="lg" radius="lg" bg="midnight.9">
                <Group mb="md">
                  <IconChartBar size={20} color="var(--mantine-color-blue-4)" />
                  <Title order={4}>Performance Impact</Title>
                </Group>
                <Stack gap="md">
                  <Box>
                    <Group justify="space-between" mb={4}>
                      <Text size="sm" fw={700}>Fatigue Contribution (ATL)</Text>
                      <Text size="sm" fw={900} c="orange">+{fatigueImpact} pts</Text>
                    </Group>
                    <Box h={6} bg="midnight.7" style={{ borderRadius: 3 }}>
                      <Box h="100%" w={`${Math.min(100, (displayTSS / 150) * 100)}%`} bg="orange.6" style={{ borderRadius: 3 }} />
                    </Box>
                  </Box>
                  <Box>
                    <Group justify="space-between" mb={4}>
                      <Text size="sm" fw={700}>Fitness Contribution (CTL)</Text>
                      <Text size="sm" fw={900} c="green">+{fitnessImpact} pts</Text>
                    </Group>
                    <Box h={6} bg="midnight.7" style={{ borderRadius: 3 }}>
                      <Box h="100%" w={`${Math.min(100, (displayTSS / 250) * 100)}%`} bg="green.6" style={{ borderRadius: 3 }} />
                    </Box>
                  </Box>
                  <Text size="xs" c="dimmed">This activity represents a moderate loading session, contributing positively to your long-term fitness base.</Text>
                </Stack>
              </Paper>

              {activity.best_efforts && activity.best_efforts.length > 0 && (
                <Paper withBorder p="lg" radius="lg" bg="midnight.9">
                  <Group mb="md">
                    <IconTrophy size={20} color="var(--mantine-color-yellow-4)" />
                    <Title order={4}>Best Efforts</Title>
                  </Group>
                  <Stack gap="xs">
                    {activity.best_efforts.map((b) => (
                      <Group key={b.name} justify="space-between">
                        <Text size="sm" fw={600}>{b.name}</Text>
                        <Text size="sm" fw={800} c="blue">{formatTime(b.elapsed_time)}</Text>
                      </Group>
                    ))}
                  </Stack>
                </Paper>
              )}
            </Stack>

            <Paper withBorder p={0} radius="lg" bg="midnight.9" style={{ overflow: 'hidden', minHeight: 400 }}>
              {mapCoords.length > 0 ? (
                <MapContainer center={mapCoords[0]} zoom={13} style={{ height: '100%', width: '100%' }}>
                  <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution='&copy; OpenStreetMap' />
                  <Polyline positions={mapCoords} pathOptions={{ color: 'var(--mantine-color-blue-6)', weight: 5, opacity: 0.8 }} />
                  <CircleMarker center={mapCoords[0]} radius={6} pathOptions={{ color: 'white', fillColor: 'var(--mantine-color-green-6)', fillOpacity: 1 }} />
                  <CircleMarker center={mapCoords[mapCoords.length - 1]} radius={6} pathOptions={{ color: 'white', fillColor: 'var(--mantine-color-red-6)', fillOpacity: 1 }} />
                  <FitBounds positions={mapCoords} />
                </MapContainer>
              ) : (
                <Stack h="100%" align="center" justify="center" c="dimmed"><IconMapPin size={48} /><Text>No route data available</Text></Stack>
              )}
            </Paper>
          </SimpleGrid>
        </>
      )}
    </Stack>
  );
}
