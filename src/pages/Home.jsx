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
import { getActivitiesFromFirebase, getAthleteSettings } from '../utils/firebaseService';
import { calculatePMC, calculateReadinessScore } from '../utils/metrics';
import { IconTrophy, IconCheck, IconCalendarEvent, IconRun, IconBike, IconBarbell, IconYoga, IconPool, IconMoon } from '@tabler/icons-react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title as ChartTitle,
  Tooltip,
  Legend,
} from 'chart.js';
import { Line } from 'react-chartjs-2';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  ChartTitle,
  Tooltip,
  Legend
);

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
  const [pmcMetrics, setPmcMetrics] = useState({ 
    ctl: 0, 
    atl: 0, 
    tsb: 0,
    trends: {
      ctl: { vsYesterday: 0, vsWeekAgo: 0 },
      atl: { vsYesterday: 0, vsWeekAgo: 0 },
      tsb: { vsYesterday: 0, vsWeekAgo: 0 },
    }
  });
  const [readinessScore, setReadinessScore] = useState({ score: 50, label: 'Unknown', color: 'gray' });
  const [pmcChartData, setPmcChartData] = useState([]);
  const [weeklyTSS, setWeeklyTSS] = useState({ current: 0, target: 600 });
  const [loadingMetrics, setLoadingMetrics] = useState(false);
  const [lastSync, setLastSync] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const authData = getStoredAuthData();
    if (authData && authData.accessToken) {
      setIsAuthenticated(true);
      setAthlete(authData.athlete);
      fetchTodayPlan(authData.athlete.id);
      fetchPMCMetrics(authData.athlete.id);
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

  const fetchPMCMetrics = async (athleteId) => {
    setLoadingMetrics(true);
    try {
      // Get athlete settings for accurate TSS calculation
      const settings = await getAthleteSettings(athleteId);
      
      // Fetch activities from the last 90 days for accurate PMC calculation
      const activities = await getActivitiesFromFirebase(athleteId, 500);
      
      if (activities && activities.length > 0) {
        // Calculate PMC (CTL, ATL, TSB)
        const pmcData = calculatePMC(activities, settings);
        
        if (pmcData && pmcData.length > 0) {
          // Get the latest PMC values
          const latestPMC = pmcData[pmcData.length - 1];
          
          // Calculate trends (vs yesterday and vs 7 days ago)
          const yesterdayPMC = pmcData.length > 1 ? pmcData[pmcData.length - 2] : null;
          const weekAgoPMC = pmcData.length > 7 ? pmcData[pmcData.length - 8] : null;
          
          const calculateTrend = (current, previous) => {
            if (!previous || previous === 0) return 0;
            return current - previous;
          };
          
          setPmcMetrics({
            ctl: latestPMC.ctl || 0,
            atl: latestPMC.atl || 0,
            tsb: latestPMC.tsb || 0,
            trends: {
              ctl: {
                vsYesterday: yesterdayPMC ? calculateTrend(latestPMC.ctl, yesterdayPMC.ctl) : 0,
                vsWeekAgo: weekAgoPMC ? calculateTrend(latestPMC.ctl, weekAgoPMC.ctl) : 0,
              },
              atl: {
                vsYesterday: yesterdayPMC ? calculateTrend(latestPMC.atl, yesterdayPMC.atl) : 0,
                vsWeekAgo: weekAgoPMC ? calculateTrend(latestPMC.atl, weekAgoPMC.atl) : 0,
              },
              tsb: {
                vsYesterday: yesterdayPMC ? calculateTrend(latestPMC.tsb, yesterdayPMC.tsb) : 0,
                vsWeekAgo: weekAgoPMC ? calculateTrend(latestPMC.tsb, weekAgoPMC.tsb) : 0,
              },
            },
          });

          // Calculate readiness score
          const readinessData = calculateReadinessScore(activities, settings);
          setReadinessScore(readinessData);

          // Get last 30 days of PMC data for the chart
          const thirtyDaysAgo = new Date();
          thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
          const chartData = pmcData.filter(point => new Date(point.date) >= thirtyDaysAgo);
          setPmcChartData(chartData);
        }
        
        // Calculate weekly TSS (Monday to Sunday of current week)
        const now = new Date();
        const currentDay = now.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
        
        // Calculate Monday of current week (Monday = 1, Sunday = 0)
        const mondayOfWeek = new Date(now);
        mondayOfWeek.setDate(now.getDate() - (currentDay === 0 ? 6 : currentDay - 1));
        mondayOfWeek.setHours(0, 0, 0, 0);
        
        // Calculate Sunday of current week (next Sunday)
        const sundayOfWeek = new Date(mondayOfWeek);
        sundayOfWeek.setDate(mondayOfWeek.getDate() + 6);
        sundayOfWeek.setHours(23, 59, 59, 999);
        
        const weeklyActivities = activities.filter(activity => {
          const activityDate = new Date(activity.start_date);
          return activityDate >= mondayOfWeek && activityDate <= sundayOfWeek;
        });
        
        const currentWeeklyTSS = weeklyActivities.reduce((sum, activity) => {
          return sum + (activity.tss || 0);
        }, 0);
        
        setWeeklyTSS({
          current: Math.round(currentWeeklyTSS),
          target: 600, // This could be made dynamic based on athlete settings
        });
        
        setLastSync(new Date());
      }
    } catch (error) {
      console.error('Error fetching PMC metrics:', error);
    } finally {
      setLoadingMetrics(false);
    }
  };

  const handleLogin = () => {
    window.location.href = getAuthorizationUrl();
  };

  const handleRefreshMetrics = async () => {
    if (athlete && athlete.id) {
      await fetchPMCMetrics(athlete.id);
    }
  };

  const getPMCChartData = () => {
    if (!pmcChartData || pmcChartData.length === 0) return null;

    const labels = pmcChartData.map(point => {
      const date = new Date(point.date);
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    });

    return {
      labels,
      datasets: [
        {
          label: 'CTL (Fitness)',
          data: pmcChartData.map(point => point.ctl),
          borderColor: '#4CAF50',
          backgroundColor: 'rgba(76, 175, 80, 0.1)',
          tension: 0.4,
          pointRadius: 0,
          pointHoverRadius: 4,
        },
        {
          label: 'ATL (Fatigue)',
          data: pmcChartData.map(point => point.atl),
          borderColor: '#FF9800',
          backgroundColor: 'rgba(255, 152, 0, 0.1)',
          tension: 0.4,
          pointRadius: 0,
          pointHoverRadius: 4,
        },
        {
          label: 'TSB (Form)',
          data: pmcChartData.map(point => point.tsb),
          borderColor: '#2196F3',
          backgroundColor: 'rgba(33, 150, 243, 0.1)',
          tension: 0.4,
          pointRadius: 0,
          pointHoverRadius: 4,
        },
        {
          label: 'Workout Days',
          data: pmcChartData.map(point => point.tss > 0 ? 0 : null), // Show at y=0 for workout days
          borderColor: 'rgba(255, 255, 255, 0.8)',
          backgroundColor: 'rgba(255, 255, 255, 0.8)',
          pointRadius: 3,
          pointHoverRadius: 6,
          pointStyle: 'rect',
          showLine: false,
          pointBorderWidth: 1,
          pointBorderColor: 'rgba(255, 255, 255, 0.8)',
        },
      ],
    };
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top',
        labels: {
          usePointStyle: true,
          padding: 20,
          filter: function(legendItem, data) {
            // Hide the "Workout Days" dataset from legend
            return legendItem.text !== 'Workout Days';
          },
        },
      },
      tooltip: {
        mode: 'index',
        intersect: false,
        callbacks: {
          label: function(context) {
            if (context.dataset.label === 'Workout Days') {
              return null; // Don't show tooltip for workout day indicators
            }
            return `${context.dataset.label}: ${context.parsed.y}`;
          },
        },
      },
    },
    scales: {
      x: {
        display: true,
        title: {
          display: true,
          text: 'Date (● = Workout Day)',
        },
        ticks: {
          maxTicksLimit: 7,
        },
      },
      y: {
        display: true,
        title: {
          display: true,
          text: 'Training Load',
        },
        beginAtZero: true,
      },
    },
    interaction: {
      mode: 'nearest',
      axis: 'x',
      intersect: false,
    },
  };

  const getTimeSinceSync = () => {
    if (!lastSync) return "Not synced yet";
    const now = new Date();
    const diffMs = now - lastSync;
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
    
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
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
                  <Text c="dimmed" size="sm">
                    Last sync: {getTimeSinceSync()} • {loadingMetrics ? "Syncing..." : "Everything looks dialed."}
                  </Text>
                </Stack>
              </Group>
              <Button 
                variant="light" 
                size="sm" 
                onClick={handleRefreshMetrics}
                loading={loadingMetrics}
              >
                Sync Metrics
              </Button>
            </Group>
          </Paper>

          <SimpleGrid cols={{ base: 1, md: 3 }} spacing="lg">
            <Box style={{ gridColumn: 'span 2' }}>
              <Title order={3} mb="md">Performance Management</Title>
              <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="md">
                <MetricCard
                  title="Fitness (CTL)"
                  value={loadingMetrics ? "..." : String(Math.round(pmcMetrics.ctl))}
                  trend={pmcMetrics.trends?.ctl?.vsYesterday > 0 ? "up" : pmcMetrics.trends?.ctl?.vsYesterday < 0 ? "down" : "neutral"}
                  trendValue={pmcMetrics.trends?.ctl?.vsYesterday !== 0 ? 
                    `${pmcMetrics.trends.ctl.vsYesterday > 0 ? '+' : ''}${Math.round(pmcMetrics.trends.ctl.vsYesterday)} (1d)` : 
                    pmcMetrics.trends?.ctl?.vsWeekAgo !== 0 ?
                    `${pmcMetrics.trends.ctl.vsWeekAgo > 0 ? '+' : ''}${Math.round(pmcMetrics.trends.ctl.vsWeekAgo)} (7d)` :
                    "-"}
                  description={
                    pmcMetrics.ctl < 20 ? "Building base fitness" :
                    pmcMetrics.ctl < 40 ? "Developing endurance" :
                    pmcMetrics.ctl < 60 ? "Good aerobic fitness" :
                    pmcMetrics.ctl < 80 ? "Strong fitness level" :
                    pmcMetrics.ctl < 100 ? "Elite fitness" :
                    "Peak performance"
                  }
                  color={
                    pmcMetrics.ctl < 20 ? "gray" :
                    pmcMetrics.ctl < 40 ? "blue" :
                    pmcMetrics.ctl < 80 ? "green" :
                    "violet"
                  }
                />
                <MetricCard
                  title="Fatigue (ATL)"
                  value={loadingMetrics ? "..." : String(Math.round(pmcMetrics.atl))}
                  trend={pmcMetrics.trends?.atl?.vsYesterday > 0 ? "up" : pmcMetrics.trends?.atl?.vsYesterday < 0 ? "down" : "neutral"}
                  trendValue={pmcMetrics.trends?.atl?.vsYesterday !== 0 ? 
                    `${pmcMetrics.trends.atl.vsYesterday > 0 ? '+' : ''}${Math.round(pmcMetrics.trends.atl.vsYesterday)} (1d)` : 
                    pmcMetrics.trends?.atl?.vsWeekAgo !== 0 ?
                    `${pmcMetrics.trends.atl.vsWeekAgo > 0 ? '+' : ''}${Math.round(pmcMetrics.trends.atl.vsWeekAgo)} (7d)` :
                    "-"}
                  description={
                    pmcMetrics.atl < 20 ? "Very low fatigue - can train hard" :
                    pmcMetrics.atl < 40 ? "Low fatigue - good recovery" :
                    pmcMetrics.atl < 60 ? "Moderate fatigue - balanced" :
                    pmcMetrics.atl < 80 ? "High fatigue - monitor closely" :
                    pmcMetrics.atl < 100 ? "Very high fatigue - reduce load" :
                    "Extreme fatigue - rest required"
                  }
                  color={
                    pmcMetrics.atl < 40 ? "green" :
                    pmcMetrics.atl < 80 ? "blue" :
                    pmcMetrics.atl < 100 ? "orange" :
                    "red"
                  }
                />
                <MetricCard
                  title="Form (TSB)"
                  value={loadingMetrics ? "..." : String(Math.round(pmcMetrics.tsb))}
                  trend={pmcMetrics.trends?.tsb?.vsYesterday > 0 ? "up" : pmcMetrics.trends?.tsb?.vsYesterday < 0 ? "down" : "neutral"}
                  trendValue={pmcMetrics.trends?.tsb?.vsYesterday !== 0 ? 
                    `${pmcMetrics.trends.tsb.vsYesterday > 0 ? '+' : ''}${Math.round(pmcMetrics.trends.tsb.vsYesterday)} (1d)` : 
                    pmcMetrics.trends?.tsb?.vsWeekAgo !== 0 ?
                    `${pmcMetrics.trends.tsb.vsWeekAgo > 0 ? '+' : ''}${Math.round(pmcMetrics.trends.tsb.vsWeekAgo)} (7d)` :
                    "-"}
                  description={
                    pmcMetrics.tsb < -30 ? "Severely overreached - rest immediately" :
                    pmcMetrics.tsb < -20 ? "High risk of overtraining - reduce volume" :
                    pmcMetrics.tsb < -10 ? "Fatigued - focus on recovery" :
                    pmcMetrics.tsb < -5 ? "Optimal training zone - can push hard" :
                    pmcMetrics.tsb < 5 ? "Maintaining fitness - balanced training" :
                    pmcMetrics.tsb < 15 ? "Fresh & rested - good for key sessions" :
                    pmcMetrics.tsb < 25 ? "Very fresh - race ready" :
                    "Peak freshness - optimal performance window"
                  }
                  color={
                    pmcMetrics.tsb < -20 ? "red" :
                    pmcMetrics.tsb < -5 ? "orange" :
                    pmcMetrics.tsb < 15 ? "green" :
                    "blue"
                  }
                />
              </SimpleGrid>

              <Title order={3} mt="xl" mb="md">Weekly Progress</Title>
              <Paper withBorder p="lg" radius="lg" bg="midnight.9">
                <Group justify="space-between" mb="xs">
                  <Stack gap={2}>
                    <Text fw={700}>Training Load Target</Text>
                    <Text size="xs" c="dimmed">
                      {(() => {
                        const now = new Date();
                        const currentDay = now.getDay();
                        const mondayOfWeek = new Date(now);
                        mondayOfWeek.setDate(now.getDate() - (currentDay === 0 ? 6 : currentDay - 1));
                        const sundayOfWeek = new Date(mondayOfWeek);
                        sundayOfWeek.setDate(mondayOfWeek.getDate() + 6);
                        return `${mondayOfWeek.toLocaleDateString()} - ${sundayOfWeek.toLocaleDateString()}`;
                      })()}
                    </Text>
                  </Stack>
                  <Text fw={900} c="blue">
                    {loadingMetrics ? "..." : `${weeklyTSS.current} / ${weeklyTSS.target} TSS`}
                  </Text>
                </Group>
                <Box h={rem(12)} bg="midnight.7" style={{ borderRadius: rem(6), overflow: 'hidden' }}>
                  <Box 
                    h="100%" 
                    w={`${Math.min(100, (weeklyTSS.current / weeklyTSS.target) * 100)}%`} 
                    bg={
                      weeklyTSS.current >= weeklyTSS.target ? "green.6" :
                      weeklyTSS.current >= weeklyTSS.target * 0.7 ? "blue.6" :
                      "yellow.6"
                    }
                    style={{ borderRadius: rem(6), transition: 'width 0.5s ease' }} 
                  />
                </Box>
                <Text size="xs" c="dimmed" mt="sm">
                  {weeklyTSS.current >= weeklyTSS.target 
                    ? "Great job! You've hit your weekly target!" 
                    : weeklyTSS.current >= weeklyTSS.target * 0.7
                    ? "You are on track to hit your weekly fatigue target. Keep it up!"
                    : "Keep pushing to reach your weekly goal."}
                </Text>
              </Paper>

              <Title order={3} mt="xl" mb="md">Training Load Trends (30 Days)</Title>
              <Paper withBorder p="lg" radius="lg" bg="midnight.9">
                <Box h={rem(300)}>
                  {getPMCChartData() ? (
                    <Line data={getPMCChartData()} options={chartOptions} />
                  ) : (
                    <Stack align="center" justify="center" h="100%" c="dimmed">
                      <Text>Not enough data to display trends</Text>
                      <Text size="sm">Complete more workouts to see your training load progression</Text>
                    </Stack>
                  )}
                </Box>
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
              <ReadinessGauge 
                score={readinessScore.score} 
                label={readinessScore.label}
                color={readinessScore.color}
                tsb={readinessScore.tsb}
                daysSinceLastActivity={readinessScore.daysSinceLastActivity}
              />

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
