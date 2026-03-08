import { useEffect, useState, useMemo } from 'react';
import { Container, Title, Text, Stack, Paper, Loader, Group, Badge, Select, Button, Box } from '@mantine/core';
import { MapContainer, TileLayer, Polyline, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { useAuth } from '../context/AuthContext';
import { getActivitiesFromFirebase } from '../utils/firebaseService';
import { decodePolyline, getBounds } from '../utils/mapUtils';
import { IconMap2, IconRefresh } from '@tabler/icons-react';

// Component to fit map bounds
function SetBounds({ bounds }) {
  const map = useMap();
  useEffect(() => {
    if (bounds) {
      map.fitBounds(bounds, { padding: [20, 20] });
    }
  }, [bounds, map]);
  return null;
}

const ACTIVITY_COLORS = {
  Run: '#FF6B6B',
  Ride: '#4DABF7',
  VerifiedRide: '#4DABF7',
  VirtualRide: '#4DABF7',
  Hike: '#20C997',
  Walk: '#20C997',
  Swim: '#FCC419',
  AlpineSki: '#e0e0e0',
  BackcountrySki: '#e0e0e0',
  Other: '#868E96',
};

function Footprint() {
  const { athlete } = useAuth();
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [yearFilter, setYearFilter] = useState('all');

  useEffect(() => {
    if (athlete?.id) {
      fetchActivities();
    }
  }, [athlete]);

  const fetchActivities = async () => {
    setLoading(true);
    try {
      // Fetch a large number of activities to get a good history
      // Start with 1000, user can implement pagination later if needed for really huge datasets
      const data = await getActivitiesFromFirebase(athlete.id, 1000);
      setActivities(data);
    } catch (error) {
      console.error("Failed to load activities for map", error);
    } finally {
      setLoading(false);
    }
  };

  const processedData = useMemo(() => {
    if (!activities.length) return { paths: [], bounds: null };

    let filtered = activities;

    // Filter by year if selected
    if (yearFilter !== 'all') {
      filtered = activities.filter(a => {
        const date = new Date(a.start_date);
        return date.getFullYear().toString() === yearFilter;
      });
    }

    const paths = [];
    const allPoints = [];

    // Filter activities with valid unique polylines
    // Using a map to deduplicate if needed, or just iterate
    filtered.forEach(activity => {
      // Check for summary polyline
      const encoded = activity.map?.summary_polyline;
      if (encoded) {
        const decoded = decodePolyline(encoded);
        if (decoded.length > 0) {
          const type = activity.type || activity.sport_type || 'Other';
          // Clean up type for color mapping
          let colorKey = 'Other';
          if (ACTIVITY_COLORS[type]) colorKey = type;
          else if (type.includes('Ride')) colorKey = 'Ride';
          else if (type.includes('Run')) colorKey = 'Run';
          else if (type.includes('Walk') || type.includes('Hike')) colorKey = 'Hike';

          paths.push({
            id: activity.id,
            positions: decoded,
            color: ACTIVITY_COLORS[colorKey] || ACTIVITY_COLORS.Other,
            name: activity.name,
            date: new Date(activity.start_date).toLocaleDateString(),
            type: activity.type
          });

          // Add start and end points to bounds calculation to approximate
          allPoints.push(decoded[0]);
          allPoints.push(decoded[decoded.length - 1]);
          // Add middle point too for better bound accuracy
          allPoints.push(decoded[Math.floor(decoded.length / 2)]);
        }
      }
    });

    const bounds = allPoints.length > 0 ? getBounds(allPoints) : null;

    return { paths, bounds };
  }, [activities, yearFilter]);

  // Generate year options
  const years = useMemo(() => {
    const uniqueYears = new Set(
      activities.map(a => new Date(a.start_date).getFullYear())
    );
    return Array.from(uniqueYears).sort((a, b) => b - a).map(y => String(y));
  }, [activities]);

  return (
    <Container size="xl" h="calc(100vh - 100px)" p={0} style={{ display: 'flex', flexDirection: 'column' }}>
      <Group justify="space-between" mb="md" px="md">
        <Stack gap={0}>
          <Group>
            <IconMap2 size={28} color="var(--mantine-color-blue-4)" />
            <Title order={2}>Global Footprint</Title>
          </Group>
          <Text c="dimmed" size="sm">
            {processedData.paths.length} activities mapped
          </Text>
        </Stack>

        <Group>
          <Select
            placeholder="Year"
            data={['all', ...years]}
            value={yearFilter}
            onChange={setYearFilter}
            w={100}
            allowDeselect={false}
          />
          <Button
            variant="light"
            leftSection={<IconRefresh size={16} />}
            onClick={fetchActivities}
            loading={loading}
          >
            Refresh
          </Button>
        </Group>
      </Group>

      <Paper
        radius="lg"
        withBorder
        style={{
          flex: 1,
          overflow: 'hidden',
          position: 'relative',
          borderColor: 'rgba(255,255,255,0.1)'
        }}
      >
        {loading && activities.length === 0 ? (
          <Group justify="center" h="100%">
            <Loader size="xl" />
          </Group>
        ) : (
          <MapContainer
            center={[20, 0]}
            zoom={2}
            style={{ height: '100%', width: '100%', background: '#1a1a1a' }}
            scrollWheelZoom={true}
          >
            {/* Dark Matter Tiles for that premium "night mode" look */}
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
              url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
            />

            {processedData.paths.map((path) => (
              <Polyline
                key={path.id}
                positions={path.positions}
                pathOptions={{
                  color: path.color,
                  weight: 2,
                  opacity: 0.3, // Low opacity for heatmap effect
                  lineCap: 'round'
                }}
                eventHandlers={{
                  click: () => {
                    console.log(`Clicked ${path.name} (${path.date})`);
                    // Could add popup here
                  }
                }}
              />
            ))}

            <SetBounds bounds={processedData.bounds} />
          </MapContainer>
        )}

        {/* Legend Overlay */}
        <Paper
          style={{
            position: 'absolute',
            bottom: 20,
            left: 20,
            zIndex: 1000,
            backgroundColor: 'rgba(0,0,0,0.7)',
            backdropFilter: 'blur(5px)'
          }}
          p="xs"
          radius="md"
        >
          <Stack gap="xs">
            <Group gap="xs">
              <Box w={12} h={4} bg={ACTIVITY_COLORS.Run} />
              <Text size="xs" c="white">Run</Text>
            </Group>
            <Group gap="xs">
              <Box w={12} h={4} bg={ACTIVITY_COLORS.Ride} />
              <Text size="xs" c="white">Ride</Text>
            </Group>
            <Group gap="xs">
              <Box w={12} h={4} bg={ACTIVITY_COLORS.Hike} />
              <Text size="xs" c="white">Hike</Text>
            </Group>
          </Stack>
        </Paper>
      </Paper>
    </Container>
  );
}

export default Footprint;
