import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Container,
  Stack,
  Group,
  Title,
  Text,
  Button,
  NumberInput,
  Paper,
  Box,
  rem,
  Loader,
  Alert,
  Divider,
  SimpleGrid,
} from '@mantine/core';
import { getStoredAuthData } from '../utils/stravaApi';
import { getAthleteSettings, updateAthleteSettings } from '../utils/firebaseService';

const AthleteSettings = () => {
  const [settings, setSettings] = useState({
    maxHeartRate: 190,
    restingHeartRate: 50,
    lthr: 165,
    ftp: 200,
    weight: 70,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  const navigate = useNavigate();
  const authData = getStoredAuthData();
  const athleteId = authData?.athlete?.id;

  useEffect(() => {
    if (!athleteId) {
      navigate('/');
      return;
    }

    const fetchSettings = async () => {
      try {
        const data = await getAthleteSettings(athleteId);
        if (data) {
          setSettings(prev => ({ ...prev, ...data }));
        }
      } catch (error) {
        console.error('Error fetching settings:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchSettings();
  }, [athleteId, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMessage({ type: '', text: '' });

    try {
      await updateAthleteSettings(athleteId, settings);
      setMessage({ type: 'success', text: 'Athlete profile updated.' });
      setTimeout(() => setMessage({ type: '', text: '' }), 3000);
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to update profile.' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Stack align="center" py={rem(100)}>
        <Loader size="xl" />
        <Text c="dimmed">Syncing profile...</Text>
      </Stack>
    );
  }

  return (
    <Stack gap="xl">
      <Stack gap={0}>
        <Title order={1}>Athlete Profile</Title>
        <Text c="dimmed">Configure your training zones for accurate intelligence metrics</Text>
      </Stack>

      <Paper withBorder p="xl" radius="lg" bg="midnight.9">
        <form onSubmit={handleSubmit}>
          <Stack gap="xl">
            <Box>
              <Title order={3} mb="md" c="blue.4">Heart Rate Zones</Title>
              <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="lg">
                <NumberInput
                  label="Max HR (bpm)"
                  value={settings.maxHeartRate}
                  onChange={(val) => setSettings({ ...settings, maxHeartRate: val })}
                  radius="md"
                />
                <NumberInput
                  label="Resting HR (bpm)"
                  value={settings.restingHeartRate}
                  onChange={(val) => setSettings({ ...settings, restingHeartRate: val })}
                  radius="md"
                />
                <NumberInput
                  label="LTHR (bpm)"
                  value={settings.lthr}
                  onChange={(val) => setSettings({ ...settings, lthr: val })}
                  radius="md"
                />
              </SimpleGrid>
            </Box>

            <Divider opacity={0.1} />

            <Box>
              <Title order={3} mb="md" c="blue.4">Power & Weight</Title>
              <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="lg">
                <NumberInput
                  label="FTP (Watts)"
                  value={settings.ftp}
                  onChange={(val) => setSettings({ ...settings, ftp: val })}
                  radius="md"
                />
                <NumberInput
                  label="Weight (kg)"
                  value={settings.weight}
                  onChange={(val) => setSettings({ ...settings, weight: val })}
                  radius="md"
                />
              </SimpleGrid>
            </Box>

            {message.text && (
              <Alert color={message.type === 'success' ? 'green' : 'red'} variant="light" radius="md">
                {message.text}
              </Alert>
            )}

            <Group justify="flex-end">
              <Button type="submit" size="md" loading={saving} px="xl" radius="md">
                Save Profile
              </Button>
            </Group>
          </Stack>
        </form>
      </Paper>
    </Stack>
  );
};

export default AthleteSettings;
