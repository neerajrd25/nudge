import { useNavigate } from 'react-router-dom';
import {
  Title,
  Text,
  Button,
  Group,
  Stack,
  SimpleGrid,
  Avatar,
  Box,
  rem,
  Paper,
  Divider,
  Badge,
} from '@mantine/core';
import { useAuth } from '../context/AuthContext';
import {
  IconTrophy,
  IconCalendarEvent,
  IconMessageChatbot,
  IconActivity
} from '@tabler/icons-react';

export function Landing() {
  const navigate = useNavigate();
  const { athlete, isAuthenticated, login } = useAuth();

  return (
    <Box className="home-content">
      <Stack gap={rem(80)}>
        {/* Hero Section */}
        <section className="hero-section" style={{ minHeight: '70vh', display: 'flex', alignItems: 'center' }}>
          <SimpleGrid cols={{ base: 1, md: 2 }} spacing={rem(40)} verticalSpacing={rem(40)}>
            <Stack gap="xl">
              <Badge
                variant="gradient"
                gradient={{ from: 'blue', to: 'cyan' }}
                size="lg"
                radius="sm"
                style={{ alignSelf: 'flex-start' }}
              >
                Beta v2.0
              </Badge>
              <Title order={1} className="hero-title" style={{ fontSize: rem(56), lineHeight: 1.1, fontWeight: 900, letterSpacing: '-1px' }}>
                The Intelligence <br />
                <span style={{
                  background: 'linear-gradient(45deg, #4DABF7 0%, #339AF0 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent'
                }}>Platform for Athletes</span>
              </Title>
              <Text size="xl" c="dimmed" style={{ maxWidth: rem(500), lineHeight: 1.6 }}>
                Professional-grade performance management and recovery analysis.
                Connect your Strava account to unlock advanced physiological insights.
              </Text>

              <Group gap="md">
                <Button
                  onClick={login}
                  size="lg"
                  style={{
                    background: '#fc4c02',
                    padding: `${rem(8)} ${rem(16)}`,
                    borderRadius: rem(8),
                    display: 'flex',
                    alignItems: 'center',
                    gap: rem(12),
                    transition: 'transform 0.15s ease',
                    boxShadow: 'none'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
                  onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
                >
                  <img
                    src="/1.1 Connect with Strava Buttons/Connect with Strava Orange/btn_strava_connect_with_orange.svg"
                    alt="Connect with Strava"
                    style={{ height: rem(32) }}
                  />
                </Button>
                <Button
                  variant="subtle"
                  size="lg"
                  color="gray"
                  onClick={() => {
                    const el = document.getElementById('features');
                    el?.scrollIntoView({ behavior: 'smooth' });
                  }}
                >
                  Learn more
                </Button>
              </Group>
            </Stack>

            <Box visibleFrom="md" style={{ position: 'relative' }}>
              <Box
                style={{
                  position: 'absolute',
                  top: '50%',
                  left: '50%',
                  transform: 'translate(-50%, -50%)',
                  width: '120%',
                  height: '120%',
                  background: 'radial-gradient(circle, rgba(33, 154, 240, 0.1) 0%, rgba(0,0,0,0) 70%)',
                  zIndex: -1
                }}
              />
              <Paper
                withBorder
                p="xl"
                radius="lg"
                bg="midnight.9"
                style={{
                  transform: 'perspective(1000px) rotateY(-10deg) rotateX(5deg)',
                  boxShadow: '0 20px 40px rgba(0,0,0,0.4)',
                  borderColor: 'rgba(255,255,255,0.05)'
                }}
              >
                <Stack gap="md">
                  <Group justify="space-between">
                    <Text fw={700} size="sm">Aerobic Efficiency</Text>
                    <Badge color="green" variant="light">Improving</Badge>
                  </Group>
                  <Box h={150} style={{ display: 'flex', alignItems: 'flex-end', gap: 4 }}>
                    {[40, 35, 45, 55, 60, 58, 65, 75, 70, 85].map((h, i) => (
                      <Box
                        key={i}
                        style={{
                          flex: 1,
                          height: `${h}%`,
                          backgroundColor: i === 9 ? 'var(--mantine-color-blue-6)' : 'rgba(255,255,255,0.05)',
                          borderRadius: '2px'
                        }}
                      />
                    ))}
                  </Box>
                  <Divider opacity={0.1} />
                  <Group grow>
                    <Stack gap={0}>
                      <Text size="xs" c="dimmed">Fitness (CTL)</Text>
                      <Text fw={900}>64.2</Text>
                    </Stack>
                    <Stack gap={0}>
                      <Text size="xs" c="dimmed">Readiness</Text>
                      <Text fw={900} c="green">High</Text>
                    </Stack>
                  </Group>
                </Stack>
              </Paper>
            </Box>
          </SimpleGrid>
        </section>

        {/* Features Section */}
        <section id="features">
          <Stack gap={rem(40)}>
            <Stack gap="xs" align="center">
              <Text fw={900} tt="uppercase" ls={rem(2)} c="blue.5" size="xs">Capabilities</Text>
              <Title order={2} ta="center" size={rem(32)}>Engineered for Performance</Title>
            </Stack>

            <SimpleGrid cols={{ base: 1, sm: 2, md: 4 }} spacing="xl">
              {[
                {
                  title: 'Precision Planner',
                  icon: <IconCalendarEvent size={32} />,
                  desc: 'Dynamic scheduling with automated Strava activity matching and variance tracking.',
                  path: '/planner',
                  color: 'blue'
                },
                {
                  title: 'Physiological Analysis',
                  icon: <IconActivity size={32} />,
                  desc: 'Track TSS, CTL, and Fatigue trends to optimize your training load.',
                  path: '/charts',
                  color: 'green'
                },
                {
                  title: 'AI Training Coach',
                  icon: <IconMessageChatbot size={32} />,
                  desc: 'Personalized recovery advice and deep-dive analysis of your performance markers.',
                  path: '/chat',
                  color: 'violet'
                },
                {
                  title: 'Performance Records',
                  icon: <IconTrophy size={32} />,
                  desc: 'Elite-level PR tracking across all distances with historical comparison.',
                  path: '/prs',
                  color: 'orange'
                }
              ].map((feature) => (
                <Paper
                  key={feature.title}
                  p="xl"
                  radius="lg"
                  withBorder
                  bg="midnight.9"
                  className="feature-item"
                  onClick={() => navigate(feature.path)}
                  style={{
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    border: '1px solid rgba(255,255,255,0.05)'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-5px)';
                    e.currentTarget.style.borderColor = `var(--mantine-color-${feature.color}-6)`;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.borderColor = 'rgba(255,255,255,0.05)';
                  }}
                >
                  <Box mb="lg" c={`${feature.color}.6`}>
                    {isAuthenticated && athlete?.profile ? (
                      <Avatar src={athlete.profile} size={40} radius="md" />
                    ) : (
                      feature.icon
                    )}
                  </Box>
                  <Text fw={700} size="lg" mb="sm">{feature.title}</Text>
                  <Text size="sm" c="dimmed" lh={1.6}>
                    {feature.desc}
                  </Text>
                </Paper>
              ))}
            </SimpleGrid>
          </Stack>
        </section>

        {/* Social Proof / Integration */}
        <Paper
          p="xl"
          radius="lg"
          bg="midnight.9"
          style={{
            border: '1px dashed rgba(255,255,255,0.1)',
            textAlign: 'center'
          }}
        >
          <Stack gap="md" align="center">
            <Text size="sm" c="dimmed">Momentum.IQ is built on top of the world's most trusted athlete data platform.</Text>
            <img
              src="/1.2-Strava-API-Logos/Powered by Strava/pwrdBy_strava_white/api_logo_pwrdBy_strava_horiz_white.svg"
              alt="Powered by Strava"
              style={{ height: rem(32), opacity: 0.8 }}
            />
          </Stack>
        </Paper>
      </Stack>
    </Box>
  );
}

export default Landing;
