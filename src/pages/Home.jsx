import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Container,
  Title,
  Text,
  Button,
  Group,
  Stack,
  Card,
  SimpleGrid,
  Avatar,
  Box,
  rem,
  Paper,
  Divider,
  UnstyledButton,
  Badge,
} from '@mantine/core';
import { getStoredAuthData, getAuthorizationUrl } from '../utils/stravaApi';
import { MetricCard } from '../components/ui/MetricCard';
import { ReadinessGauge } from '../components/ui/ReadinessGauge';
import { getPlannedWorkouts, savePlannedWorkout } from '../utils/plannerService';
import { IconTrophy, IconCheck, IconCalendarEvent, IconRun, IconBike, IconBarbell, IconYoga, IconPool, IconMoon } from '@tabler/icons-react';

const ACTIVITY_CONFIG = {
  run: { color: 'red.7', icon: <IconRun size={18} />, gradient: 'linear-gradient(45deg, #FF6B6B 0%, #D6336C 100%)' },
  cycle: { color: 'blue.7', icon: <IconBike size={18} />, gradient: 'linear-gradient(45deg, #4DABF7 0%, #339AF0 100%)' },
  swim: { color: 'cyan.7', icon: <IconPool size={18} />, gradient: 'linear-gradient(45deg, #20C997 0%, #08979C 100%)' },
  strength: { color: 'violet.7', icon: <IconBarbell size={18} />, gradient: 'linear-gradient(45deg, #845EF7 0%, #7048E8 100%)' },
  mobility: { color: 'teal.7', icon: <IconYoga size={18} />, gradient: 'linear-gradient(45deg, #12B886 0%, #0CA678 100%)' },
  rest: { color: 'gray.7', icon: <IconMoon size={18} />, gradient: 'linear-gradient(45deg, #868E96 0%, #495057 100%)' },
  workout: { color: 'indigo.7', icon: <IconBarbell size={18} />, gradient: 'linear-gradient(45deg, #5C7CFA 0%, #4263EB 100%)' },
};

function getActivityType(item) {
  if (item.activityType) return item.activityType.toLowerCase();
  const name = (item.plannedActivity || '').toLowerCase();
  const details = (item.details || '').toLowerCase();
  const combined = `${name} ${details}`;
  if (combined.includes('run')) return 'run';
  if (combined.includes('ride') || combined.includes('cycle') || combined.includes('spin') || combined.includes('bike')) return 'cycle';
  if (combined.includes('swim')) return 'swim';
  if (combined.includes('strength') || combined.includes('gym') || combined.includes('lift') || combined.includes('weight')) return 'strength';
  if (combined.includes('mobility') || combined.includes('rehab') || combined.includes('yoga') || combined.includes('stretch')) return 'mobility';
  if (combined.includes('rest')) return 'rest';
  return 'run';
}

function Home() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [athlete, setAthlete] = useState(null);
  const [todayPlan, setTodayPlan] = useState([]);
  const [loadingPlan, setLoadingPlan] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const authData = getStoredAuthData();
    if (authData && authData.accessToken) {
      setIsAuthenticated(true);
      setAthlete(authData.athlete);
      fetchTodayPlan(authData.athlete.id);
    }
  }, []);

  const fetchTodayPlan = async (athleteId) => {
    setLoadingPlan(true);
    try {
      const today = new Date();
      const items = await getPlannedWorkouts(athleteId, today, today);
      setTodayPlan(items);
    } catch (e) {
      console.error('Failed to fetch today plan', e);
    } finally {
      setLoadingPlan(false);
    }
  };

  const handleLogin = () => {
    window.location.href = getAuthorizationUrl();
  };

  return (
    <Box className="home-content">
      {!isAuthenticated ? (
        <Stack gap={rem(60)}>
          <section className="hero-section">
            <Stack gap="xl" className="hero-text">
              <Title order={1} className="hero-title">
                The <span className="highlight-text">Intelligence</span> <br />
                platform for athletes.
              </Title>
              <Text size="xl" c="dimmed" className="hero-subtitle">
                Connect Strava. Get elite-level recovery & variance analysis.
                Train smarter with NUDGE.IQ.
              </Text>
              <Button
                size="xl"
                variant="gradient"
                gradient={{ from: 'blue.6', to: 'cyan.6' }}
                onClick={handleLogin}
                className="cta-button"
              >
                Sign in with Strava
              </Button>
            </Stack>

            <Box className="hero-visual" visibleFrom="md">
              <div className="visual-card stats">
                <span className="visual-icon">📈</span>
                <div className="visual-content">
                  <div className="skeleton-line"></div>
                  <div className="skeleton-line short"></div>
                </div>
              </div>
              <div className="visual-card calendar">
                <span className="visual-icon">📅</span>
                <div className="visual-content">
                  <div className="skeleton-line"></div>
                  <div className="skeleton-line short"></div>
                </div>
              </div>
            </Box>
          </section>

          <SimpleGrid cols={{ base: 1, sm: 2, md: 4 }} spacing="lg">
            <Card padding="xl" radius="md" withBorder className="feature-item" onClick={() => navigate('/planner')}>
              <Text size={rem(40)} mb="md">📅</Text>
              <Text fw={700} size="lg" mb="sm">Precision Planner</Text>
              <Text size="sm" c="dimmed">
                Dynamic plans with automated Strava matching and variance tracking.
              </Text>
            </Card>
            <Card padding="xl" radius="md" withBorder className="feature-item" onClick={() => navigate('/activities')}>
              <Text size={rem(40)} mb="md">📊</Text>
              <Text fw={700} size="lg" mb="sm">Advanced Metrics</Text>
              <Text size="sm" c="dimmed">
                Track TSS, CTL, and Fatigue like a pro athlete.
              </Text>
            </Card>
            <Card padding="xl" radius="md" withBorder className="feature-item" onClick={() => navigate('/chat')}>
              <Text size={rem(40)} mb="md">🤖</Text>
              <Text fw={700} size="lg" mb="sm">AI Training Coach</Text>
              <Text size="sm" c="dimmed">
                Actionable recovery advice and personalized analysis.
              </Text>
            </Card>
            <Card padding="xl" radius="md" withBorder className="feature-item" onClick={() => navigate('/prs')}>
              <Text size={rem(40)} mb="md">🏆</Text>
              <Text fw={700} size="lg" mb="sm">Elite PR Tracking</Text>
              <Text size="sm" c="dimmed">
                Deep dive into your personal records across all distances.
              </Text>
            </Card>
          </SimpleGrid>
        </Stack>
      ) : (
        <Stack gap="xl">
          <Paper
            withBorder
            p="xl"
            radius="lg"
            bg="midnight.9"
            style={{
              background: 'linear-gradient(135deg, rgba(33, 150, 243, 0.05) 0%, rgba(0, 0, 0, 0) 100%)',
              borderColor: 'rgba(33, 150, 243, 0.2)'
            }}
          >
            <Group justify="space-between">
              <Group>
                <Avatar src={athlete?.profile} size="xl" radius="xl" />
                <Stack gap={0}>
                  <Title order={1}>Insights for {athlete?.firstname}</Title>
                  <Text c="dimmed" size="sm">Last sync: 12 minutes ago • Everything looks dialed.</Text>
                </Stack>
              </Group>
              <Button variant="light" size="sm" onClick={() => navigate('/activities')}>Sync Now</Button>
            </Group>
          </Paper>

          <SimpleGrid cols={{ base: 1, md: 3 }} spacing="lg">
            <Box style={{ gridColumn: 'span 2' }}>
              <Title order={3} mb="md">Performance Management</Title>
              <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="md">
                <MetricCard
                  title="Fitness (CTL)"
                  value="42"
                  trend="up"
                  trendValue="+12%"
                  description="Building solid base"
                />
                <MetricCard
                  title="Fatigue (ATL)"
                  value="58"
                  trend="up"
                  trendValue="+5%"
                  description="Moderate loading"
                  color="orange"
                />
                <MetricCard
                  title="Form (TSB)"
                  value="-16"
                  trend="down"
                  trendValue="-2"
                  description="Optimal Training Zone"
                  color="green"
                />
              </SimpleGrid>

              <Title order={3} mt="xl" mb="md">Weekly Progress</Title>
              <Paper withBorder p="lg" radius="lg" bg="midnight.9">
                <Group justify="space-between" mb="xs">
                  <Text fw={700}>Training Load Target</Text>
                  <Text fw={900} c="blue">420 / 600 TSS</Text>
                </Group>
                <Box h={rem(12)} bg="midnight.7" style={{ borderRadius: rem(6), overflow: 'hidden' }}>
                  <Box h="100%" w="70%" bg="blue.6" style={{ borderRadius: rem(6) }} />
                </Box>
                <Text size="xs" c="dimmed" mt="sm">You are on track to hit your weekly fatigue target. Keep it up!</Text>
              </Paper>

              <Title order={3} mt="xl" mb="md">Today's Plan</Title>
              {todayPlan.length > 0 ? (
                <Stack gap="md">
                  {todayPlan.map((item) => {
                    const type = getActivityType(item);
                    const config = ACTIVITY_CONFIG[type] || ACTIVITY_CONFIG.workout;
                    return (
                      <Paper
                        key={item.id}
                        withBorder
                        p="md"
                        radius="lg"
                        bg="midnight.9"
                        style={{
                          borderLeft: item.raceType === 'A' ? '6px solid var(--mantine-color-red-7)' :
                            `4px solid var(--mantine-color-${config.color.split('.')[0]}-${config.color.split('.')[1] || '6'})`,
                          boxShadow: item.raceType === 'A' ? '0 0 20px rgba(255,0,0,0.2)' : '0 4px 15px rgba(0,0,0,0.1)'
                        }}
                      >
                        <Group justify="space-between" wrap="nowrap">
                          <Group gap="md">
                            <Box
                              p={10}
                              bg={item.raceType === 'A' ? 'maroon' : config.color}
                              style={{
                                borderRadius: '12px',
                                display: 'flex',
                                backgroundImage: item.raceType === 'A' ? 'none' : config.gradient,
                                boxShadow: '0 4px 8px rgba(0,0,0,0.2)'
                              }}
                            >
                              {item.raceType === 'A' ? <IconTrophy size={20} color="white" /> : (config.icon || <IconCalendarEvent size={20} color="white" />)}
                            </Box>
                            <Stack gap={2}>
                              <Group gap="xs">
                                <Text fw={900} size="lg" c="white" ls="0.5px">
                                  {item.raceType === 'A' && '🏆 '}{item.plannedActivity}
                                </Text>
                                {item.raceType && <Badge size="xs" color={item.raceType === 'A' ? 'yellow.4' : 'blue.4'} variant="outline">Priority {item.raceType}</Badge>}
                              </Group>
                              <Text size="sm" c="dimmed" lineClamp={1}>{item.details}</Text>
                              <Group gap="xs" mt={4}>
                                <Badge variant="dot" size="sm" color="gray.5">{item.plannedDuration} min</Badge>
                                {item.focus && <Badge size="xs" variant="light" color="indigo.4">{item.focus}</Badge>}
                              </Group>
                            </Stack>
                          </Group>
                          {item.status === 'done' ? (
                            <Badge color="green" variant="filled" size="lg" leftSection={<IconCheck size={14} />}>Completed</Badge>
                          ) : (
                            <Button
                              variant="filled"
                              color="blue"
                              size="sm"
                              radius="md"
                              onClick={() => navigate('/planner')}
                              rightSection={<IconCalendarEvent size={18} />}
                              style={{ boxShadow: '0 4px 10px rgba(33, 150, 243, 0.3)' }}
                            >
                              Start Training
                            </Button>
                          )}
                        </Group>
                      </Paper>
                    );
                  })}
                </Stack>
              ) : (
                <Paper withBorder p="xl" radius="lg" bg="midnight.9" style={{ borderStyle: 'dashed' }}>
                  <Stack align="center" gap="xs">
                    <Text c="dimmed">No activities planned for today.</Text>
                    <Button variant="subtle" size="xs" onClick={() => navigate('/planner')}>Plan something</Button>
                  </Stack>
                </Paper>
              )}
            </Box>

            <Stack gap="lg">
              <Title order={3}>Readiness Score</Title>
              <ReadinessGauge score={84} label="Optimal Recovery" />

              <Title order={3}>AI Recommendations</Title>
              <Paper withBorder p="md" radius="lg" bg="midnight.9">
                <Stack gap="xs">
                  <Group gap="xs">
                    <Box w={8} h={8} bg="blue.6" style={{ borderRadius: '50%' }} />
                    <Text size="sm" fw={700}>Focus on Zone 2 today</Text>
                  </Group>
                  <Text size="xs" c="dimmed">Your ATL is spiking. A lower intensity session will help maintain CTL without overtraining risk.</Text>
                  <Divider my="xs" opacity={0.3} />
                  <Button variant="subtle" size="xs" fullWidth color="blue" onClick={() => navigate('/chat')}>Discuss with AI Coach</Button>
                </Stack>
              </Paper>
            </Stack>
          </SimpleGrid>

          <Divider my="xl" label="Quick Access" labelPosition="center" />

          <SimpleGrid cols={{ base: 2, sm: 3, md: 6 }} spacing="sm">
            {[
              { title: 'Activities', icon: '📊', path: '/activities' },
              { title: 'Planner', icon: '📅', path: '/planner' },
              { title: 'Analytics', icon: '📈', path: '/year-stats' },
              { title: 'Coach', icon: '💬', path: '/chat' },
              { title: 'PRs', icon: '🏆', path: '/prs' },
              { title: 'Settings', icon: '⚙️', path: '/settings' }
            ].map((item) => (
              <UnstyledButton
                key={item.path}
                onClick={() => navigate(item.path)}
                p="md"
                style={{
                  backgroundColor: 'var(--mantine-color-midnight-9)',
                  border: '1px solid rgba(255,255,255,0.05)',
                  borderRadius: rem(12),
                  textAlign: 'center',
                  transition: 'transform 0.1s ease, background 0.1s ease'
                }}
                className="quick-action-btn"
              >
                <Stack gap={4} align="center">
                  <Text size="xl">{item.icon}</Text>
                  <Text size="xs" fw={700}>{item.title}</Text>
                </Stack>
              </UnstyledButton>
            ))}
          </SimpleGrid>
        </Stack>
      )}
    </Box>
  );
}

export default Home;
