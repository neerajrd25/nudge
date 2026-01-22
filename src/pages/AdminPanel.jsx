import {
  Container,
  Title,
  Text,
  Button,
  Group,
  Stack,
  Paper,
  TextInput,
  Loader,
  Badge,
  Code,
  Divider,
} from '@mantine/core';
import { useNavigate } from 'react-router-dom';
import {
  getStoredAuthData,
  getAllAthleteActivities,
  refreshAccessToken,
  storeAuthData,
  isTokenExpired,
} from '../utils/stravaApi';
import {
  getActivitiesFromFirebase,
  deleteAllActivities,
  syncActivitiesAndComputeKPIs,
  getKPIsForAthlete,
} from '../utils/firebaseService';
import { useEffect, useState } from 'react';

function AdminPanel() {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('');
  const [result, setResult] = useState(null);
  const [rangeStart, setRangeStart] = useState('');
  const [rangeEnd, setRangeEnd] = useState('');
  const [activityCount, setActivityCount] = useState(null);
  const navigate = useNavigate();

  const ensureAuthAndGetToken = async () => {
    const authData = getStoredAuthData();

    if (!authData || !authData.accessToken) {
      navigate('/');
      throw new Error('Not authenticated');
    }

    let accessToken = authData.accessToken;

    if (isTokenExpired() && authData.refreshToken) {
      setStatus('Refreshing Strava token...');
      const newAuthData = await refreshAccessToken(authData.refreshToken);
      storeAuthData(newAuthData);
      accessToken = newAuthData.access_token;
    }

    return { accessToken, athlete: authData.athlete };
  };

  const handleListFirebase = async () => {
    try {
      setLoading(true);
      setStatus('Fetching activities from Firebase...');
      setResult(null);

      const { athlete } = await ensureAuthAndGetToken();
      if (!athlete || !athlete.id) throw new Error('Athlete id not available');

      const activities = await getActivitiesFromFirebase(String(athlete.id), 500);
      setResult({ success: true, count: activities.length, sample: activities.slice(0, 10) });
      setStatus(`Found ${activities.length} activities`);
    } catch (err) {
      console.error('List error:', err);
      setResult({ success: false, message: err.message });
      setStatus('List failed');
    } finally {
      setLoading(false);
    }
  };

  const handleClearFirebase = async () => {
    try {
      setLoading(true);
      setStatus('Deleting activities from Firebase...');
      setResult(null);

      const { athlete } = await ensureAuthAndGetToken();
      if (!athlete || !athlete.id) throw new Error('Athlete id not available');

      const res = await deleteAllActivities(String(athlete.id));
      setResult(res);
      setStatus('Deletion complete');
    } catch (err) {
      console.error('Delete error:', err);
      setResult({ success: false, message: err.message });
      setStatus('Deletion failed');
    } finally {
      setLoading(false);
    }
  };

  const handleShowKPIs = async () => {
    try {
      setLoading(true);
      setStatus('Fetching KPI documents from Firebase...');
      setResult(null);

      const { athlete } = await ensureAuthAndGetToken();
      if (!athlete || !athlete.id) throw new Error('Athlete id not available');

      const kpis = await getKPIsForAthlete(String(athlete.id));
      setResult({ success: true, kpis });
      setStatus(`Fetched ${Object.keys(kpis).length} KPI documents`);
    } catch (err) {
      console.error('Fetch KPIs error:', err);
      setResult({ success: false, message: err.message });
      setStatus('Fetch KPIs failed');
    } finally {
      setLoading(false);
    }
  };

  const fetchActivityCount = async () => {
    try {
      setStatus('Counting activities in Firebase...');
      const { athlete } = await ensureAuthAndGetToken();
      if (!athlete || !athlete.id) throw new Error('Athlete id not available');

      const activities = await getActivitiesFromFirebase(String(athlete.id), 1000000);
      setActivityCount(activities.length);
      setStatus(`Activities in Firebase: ${activities.length}`);
    } catch (err) {
      console.error('Count error:', err);
      setActivityCount(null);
      setStatus('Count failed');
    }
  };

  const handleFullSyncWithKPIs = async () => {
    try {
      setLoading(true);
      setStatus('Starting full Strava -> Firebase sync...');
      setResult(null);

      const { accessToken, athlete } = await ensureAuthAndGetToken();
      if (!athlete || !athlete.id) throw new Error('Athlete id not available');

      const activities = await getAllAthleteActivities(accessToken);
      const res = await syncActivitiesAndComputeKPIs(String(athlete.id), activities);

      setResult(res);
      setStatus('Full sync complete');
    } catch (err) {
      console.error('Full sync error:', err);
      setResult({ success: false, message: err.message });
      setStatus('Full sync failed');
    } finally {
      setLoading(false);
    }
  };

  const handleRangeSync = async () => {
    try {
      if (!rangeStart || !rangeEnd) throw new Error('Please provide dates');

      const startMs = new Date(rangeStart);
      const endMs = new Date(rangeEnd);
      endMs.setHours(23, 59, 59, 999);

      if (startMs > endMs) throw new Error('Invalid range');

      setLoading(true);
      setStatus(`Syncing ${rangeStart} → ${rangeEnd}...`);
      setResult(null);

      const { accessToken, athlete } = await ensureAuthAndGetToken();
      if (!athlete || !athlete.id) throw new Error('Athlete id not available');

      const activities = await getAllAthleteActivities(accessToken);
      const startSec = Math.floor(startMs.getTime() / 1000);
      const endSec = Math.floor(endMs.getTime() / 1000);

      const filtered = activities.filter((act) => {
        const dt = act.start_date || act.start_date_local;
        if (!dt) return false;
        const actSec = Math.floor(new Date(dt).getTime() / 1000);
        return actSec >= startSec && actSec <= endSec;
      });

      const res = await syncActivitiesAndComputeKPIs(String(athlete.id), filtered);
      setResult(res);
      setStatus('Range sync complete');
    } catch (err) {
      setResult({ success: false, message: err.message });
      setStatus('Range sync failed');
    } finally {
      setLoading(false);
      try { await fetchActivityCount(); } catch (e) { }
    }
  };

  useEffect(() => {
    fetchActivityCount().catch(() => { });
  }, []);

  return (
    <Container size="lg" py="xl">
      <Stack gap="xl">
        <Group justify="space-between" align="center">
          <Stack gap={0}>
            <Title order={1} c="blue.4">Admin Panel</Title>
            <Text c="dimmed">Data management and synchronization tools</Text>
          </Stack>
          <Button variant="light" onClick={() => navigate('/')}>
            Back to Dashboard
          </Button>
        </Group>

        <Paper withBorder p="xl" radius="md">
          <Stack gap="md">
            <Group>
              <Button onClick={handleListFirebase} loading={loading} variant="outline">
                List Activities
              </Button>
              <Button onClick={handleShowKPIs} loading={loading} variant="outline">
                Show KPIs
              </Button>
              <Button onClick={handleClearFirebase} loading={loading} variant="filled" color="red">
                Clear activities
              </Button>
              <Button onClick={handleFullSyncWithKPIs} loading={loading} variant="filled">
                Full Sync
              </Button>
            </Group>

            <Divider label="Date Range Sync" labelPosition="center" />

            <Group align="flex-end">
              <TextInput
                label="Start Date"
                type="date"
                value={rangeStart}
                onChange={(e) => setRangeStart(e.currentTarget.value)}
              />
              <TextInput
                label="End Date"
                type="date"
                value={rangeEnd}
                onChange={(e) => setRangeEnd(e.currentTarget.value)}
              />
              <Button
                onClick={handleRangeSync}
                disabled={!rangeStart || !rangeEnd}
                loading={loading}
              >
                Sync Range
              </Button>
            </Group>
          </Stack>
        </Paper>

        <Paper withBorder p="md" radius="md">
          <Group justify="space-between">
            <Group>
              <Text fw={700}>Activities in Firebase:</Text>
              <Badge size="lg" variant="light" color="blue">
                {activityCount === null ? '...' : activityCount}
              </Badge>
            </Group>
            <Button variant="subtle" size="xs" onClick={fetchActivityCount} loading={loading}>
              Refresh Count
            </Button>
          </Group>
        </Paper>

        {status && (
          <Paper withBorder p="sm" radius="md" bg="var(--mantine-color-blue-light)">
            <Text size="sm" fw={500} c="blue">
              {status}
            </Text>
          </Paper>
        )}

        {loading && (
          <Group justify="center" py="xl">
            <Loader size="xl" />
          </Group>
        )}

        {result && (
          <Stack gap="xs">
            <Text fw={700}>Last Result:</Text>
            <Paper withBorder p="md" radius="md" bg="rgba(255, 255, 255, 0.02)">
              <Code block color="blue.9">
                {JSON.stringify(result, null, 2)}
              </Code>
            </Paper>
          </Stack>
        )}

        <Paper withBorder p="md" radius="md">
          <Stack gap="xs">
            <Text fw={700} borderBottom="1px solid rgba(255,255,255,0.1)" pb="xs">Notes:</Text>
            <Text size="sm" c="dimmed">
              • Full Sync fetches all activities from Strava and computes KPIs.<br />
              • Clear permanently deletes documents from Firebase.<br />
              • Authentication uses localStorage tokens.
            </Text>
          </Stack>
        </Paper>
      </Stack>
    </Container>
  );
}

export default AdminPanel;
