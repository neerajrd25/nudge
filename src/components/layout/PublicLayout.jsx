import { AppShell, Container, Group, Text, Box, Button, rem, Stack } from '@mantine/core';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

export function PublicLayout({ children }) {
  const navigate = useNavigate();
  const { login } = useAuth();

  return (
    <AppShell
      header={{ height: 60 }}
      padding="md"
    >
      <AppShell.Header bg="midnight.9" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        <Group h="100%" px="md" justify="space-between">
          <Group
            onClick={() => navigate('/')}
            style={{ cursor: 'pointer' }}
            gap={rem(8)}
          >
            <img
              src="/momentum_iq.png"
              alt="Momentum.IQ logo"
              style={{ height: rem(36), borderRadius: rem(8) }}
            />
            <Text
              size="xl"
              fw={900}
              variant="gradient"
              gradient={{ from: 'blue', to: 'cyan' }}
              style={{ fontFamily: 'Outfit, sans-serif' }}
            >
              Momentum<span style={{ color: '#fff' }}>.IQ</span>
            </Text>
          </Group>

          <Button
            size="sm"
            variant="filled"
            color="orange"
            onClick={login}
            style={{ background: '#fc4c02' }}
          >
            Connect Strava
          </Button>
        </Group>
      </AppShell.Header>

      <AppShell.Main bg="midnight.8" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        <Container size="xl" py="md" style={{ flex: 1, width: '100%' }}>
          {children}
        </Container>

        <Box
          component="footer"
          p="xl"
          bg="midnight.9"
          style={{
            borderTop: '1px solid rgba(255,255,255,0.05)',
            textAlign: 'center'
          }}
        >
          <Stack gap="xs" align="center">
            <Group gap="xs" justify="center">
              <Text size="xs" c="dimmed" fw={500}>© {new Date().getFullYear()} Momentum.IQ</Text>
              <Box w={4} h={4} bg="dimmed" style={{ borderRadius: '50%' }} />
              <Text size="xs" c="dimmed" fw={500}>Professional Athlete Intelligence</Text>
            </Group>
            <Group gap="sm" justify="center">
              <img
                src="/1.2-Strava-API-Logos/Powered by Strava/pwrdBy_strava_white/api_logo_pwrdBy_strava_horiz_white.svg"
                alt="Powered by Strava"
                style={{ height: rem(24), opacity: 0.7 }}
              />
            </Group>
          </Stack>
        </Box>
      </AppShell.Main>
    </AppShell>
  );
}

export default PublicLayout;
