import { useEffect, useState, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Stack, Title, Text, Loader, Paper, Center, rem, ThemeIcon } from '@mantine/core';
import { IconCheck, IconX, IconLoader } from '@tabler/icons-react';
import { exchangeToken, storeAuthData } from '../utils/stravaApi';

function Callback() {
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState('processing');
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  const hasProcessed = useRef(false);

  useEffect(() => {
    if (hasProcessed.current) return;

    const code = searchParams.get('code');
    const errorParam = searchParams.get('error');

    if (errorParam || !code) {
      setStatus('error');
      setError(errorParam ? 'Authorization was denied' : 'No authorization code received');
      setTimeout(() => navigate('/'), 3000);
      return;
    }

    const handleCallback = async () => {
      hasProcessed.current = true;
      try {
        const data = await exchangeToken(code);
        storeAuthData(data);
        // notify app that auth changed so layouts/pages can refresh state
        window.dispatchEvent(new Event('authChanged'));
        setStatus('success');
        setTimeout(() => navigate('/'), 1500);
      } catch (err) {
        setStatus('error');
        setError(err.message || 'Failed to authenticate with Strava');
        setTimeout(() => navigate('/'), 3000);
      }
    };

    handleCallback();
  }, [searchParams, navigate]);

  return (
    <Center h="100vh" bg="midnight.9">
      <Paper withBorder p={rem(60)} radius="lg" bg="midnight.8" shadow="xl" style={{ maxWidth: 450, width: '100%' }}>
        <Stack align="center" gap="xl">
          {status === 'processing' && (
            <>
              <Loader size="xl" variant="bars" />
              <Stack gap={4} align="center">
                <Title order={2}>Connecting IQ</Title>
                <Text c="dimmed" ta="center">Authenticating your athlete profile with Strava...</Text>
              </Stack>
            </>
          )}

          {status === 'success' && (
            <>
              <ThemeIcon size={80} radius="xl" color="green" variant="light">
                <IconCheck size={40} />
              </ThemeIcon>
              <Stack gap={4} align="center">
                <Title order={2}>Sync Successful</Title>
                <Text c="dimmed" ta="center">Welcome to Momentum.IQ. Redirecting to your dashboard...</Text>
              </Stack>
            </>
          )}

          {status === 'error' && (
            <>
              <ThemeIcon size={80} radius="xl" color="red" variant="light">
                <IconX size={40} />
              </ThemeIcon>
              <Stack gap={4} align="center">
                <Title order={2}>Sync Failed</Title>
                <Text c="red.4" ta="center" fw={700}>{error}</Text>
                <Text size="sm" c="dimmed">Redirecting you back shortly...</Text>
              </Stack>
            </>
          )}
        </Stack>
      </Paper>
    </Center>
  );
}

export default Callback;
