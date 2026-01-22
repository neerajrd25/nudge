import { useEffect, useState } from 'react';
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
  UnstyledButton,
  Badge,
} from '@mantine/core';
import { useAuth } from '../context/AuthContext';
import { MetricCard } from '../components/ui/MetricCard';
import { ReadinessGauge } from '../components/ui/ReadinessGauge';
import { getPlannedWorkouts } from '../utils/plannerService';
import { getActivitiesFromFirebase, getAthleteSettings } from '../utils/firebaseService';
import { calculatePMC, calculateReadinessScore, getActivityType, estimatePlannedTSS } from '../utils/metrics';
import {
  IconTrophy,
  IconCalendarEvent,
  IconRun,
  IconBike,
  IconBarbell,
  IconYoga,
  IconPool,
  IconMoon,
  IconCheck,
} from '@tabler/icons-react';
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


export function Dashboard() {
  const { athlete, loadingMetrics: contextLoading, refreshAuth } = useAuth();
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
    if (athlete) {
      fetchTodayPlan(athlete.id);
      fetchPMCMetrics(athlete.id);
    }
  }, [athlete]);

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
      const settings = await getAthleteSettings(athleteId);
      const activities = await getActivitiesFromFirebase(athleteId, 500);

      if (activities && activities.length > 0) {
        const pmcData = calculatePMC(activities, settings);

        if (pmcData && pmcData.length > 0) {
          const latestPMC = pmcData[pmcData.length - 1];
          const yesterdayPMC = pmcData.length > 1 ? pmcData[pmcData.length - 2] : null;
          const weekAgoPMC = pmcData.length > 7 ? pmcData[pmcData.length - 8] : null;

          const calculateTrend = (current, previous) => (previous ? current - previous : 0);

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

          const readinessData = calculateReadinessScore(activities, settings);
          setReadinessScore(readinessData);

          const thirtyDaysAgo = new Date();
          thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
          const chartData = pmcData.filter(point => new Date(point.date) >= thirtyDaysAgo);
          setPmcChartData(chartData);
        }

        const now = new Date();
        const currentDay = now.getDay();
        // Calculate Monday of current week (Monday = 1, Sunday = 0)
        const mondayOfWeek = new Date(now);
        mondayOfWeek.setDate(now.getDate() - (currentDay === 0 ? 6 : currentDay - 1));
        mondayOfWeek.setHours(0, 0, 0, 0);

        // Calculate Sunday of current week (next Sunday)
        const sundayOfWeek = new Date(mondayOfWeek);
        sundayOfWeek.setDate(mondayOfWeek.getDate() + 6);
        sundayOfWeek.setHours(23, 59, 59, 999);

        // Fetch all planned workouts for this week to determine target
        const weeklyPlanned = await getPlannedWorkouts(athleteId, mondayOfWeek, sundayOfWeek);
        const plannedTSS = weeklyPlanned.reduce((sum, item) => sum + estimatePlannedTSS(item), 0);

        // Calculate actual TSS: sum all Strava activities + manually completed workouts without links
        const weeklyActivities = activities.filter(activity => {
          const activityDate = new Date(activity.start_date);
          return activityDate >= mondayOfWeek && activityDate <= sundayOfWeek;
        });

        const stravaTSS = weeklyActivities.reduce((sum, activity) => sum + (activity.tss || 0), 0);

        // Add TSS from manually completed workouts that are NOT linked to any Strava activity
        const manualTSS = weeklyPlanned.reduce((sum, item) => {
          if (item.status === 'done' && !item.stravaActivityId) {
            return sum + (item.actualTss || estimatePlannedTSS(item));
          }
          return sum;
        }, 0);

        setWeeklyTSS({
          current: Math.round(stravaTSS + manualTSS),
          target: plannedTSS || settings?.weeklyTssTarget || 600,
        });

        setLastSync(new Date());
      }
    } catch (error) {
      console.error('Error fetching PMC metrics:', error);
    } finally {
      setLoadingMetrics(false);
    }
  };

  const handleRefreshMetrics = () => {
    if (athlete?.id) fetchPMCMetrics(athlete.id);
  };

  const getPMCChartData = () => {
    if (!pmcChartData || pmcChartData.length === 0) return null;
    const labels = pmcChartData.map(point => new Date(point.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));

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
          data: pmcChartData.map(point => point.tss > 0 ? 0 : null),
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
          filter: (legendItem) => legendItem.text !== 'Workout Days',
        },
      },
      tooltip: {
        mode: 'index',
        intersect: false,
        callbacks: {
          label: (context) => context.dataset.label === 'Workout Days' ? null : `${context.dataset.label}: ${context.parsed.y}`,
        },
      },
    },
    scales: {
      x: { title: { display: true, text: 'Date (● = Workout Day)' }, ticks: { maxTicksLimit: 7 } },
      y: { title: { display: true, text: 'Training Load' }, beginAtZero: true },
    },
    interaction: { mode: 'nearest', axis: 'x', intersect: false },
  };

  const getTimeSinceSync = () => {
    if (!lastSync) return "Not synced yet";
    const now = new Date();
    const diffMins = Math.floor((now - lastSync) / 60000);
    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    return `${Math.floor(diffHours / 24)} day${Math.floor(diffHours / 24) > 1 ? 's' : ''} ago`;
  };

  return (
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
              description={pmcMetrics.ctl < 20 ? "Building base fitness" : pmcMetrics.ctl < 40 ? "Developing endurance" : "High fitness level"}
              color={pmcMetrics.ctl < 40 ? "blue" : "green"}
            />
            <MetricCard
              title="Fatigue (ATL)"
              value={loadingMetrics ? "..." : String(Math.round(pmcMetrics.atl))}
              trend={pmcMetrics.trends?.atl?.vsYesterday > 0 ? "up" : pmcMetrics.trends?.atl?.vsYesterday < 0 ? "down" : "neutral"}
              trendValue={pmcMetrics.trends?.atl?.vsYesterday !== 0 ?
                `${pmcMetrics.trends.atl.vsYesterday > 0 ? '+' : ''}${Math.round(pmcMetrics.trends.atl.vsYesterday)} (1d)` :
                "-"}
              description={pmcMetrics.atl < 40 ? "Low fatigue" : "Moderate fatigue"}
              color={pmcMetrics.atl < 60 ? "green" : "orange"}
            />
            <MetricCard
              title="Form (TSB)"
              value={loadingMetrics ? "..." : String(Math.round(pmcMetrics.tsb))}
              trend={pmcMetrics.trends?.tsb?.vsYesterday > 0 ? "up" : pmcMetrics.trends?.tsb?.vsYesterday < 0 ? "down" : "neutral"}
              trendValue={pmcMetrics.trends?.tsb?.vsYesterday !== 0 ?
                `${pmcMetrics.trends.tsb.vsYesterday > 0 ? '+' : ''}${Math.round(pmcMetrics.trends.tsb.vsYesterday)} (1d)` :
                "-"}
              description={pmcMetrics.tsb < -10 ? "Fatigued" : "Rested"}
              color={pmcMetrics.tsb < -5 ? "orange" : "green"}
            />
          </SimpleGrid>

          <Title order={3} mt="xl" mb="md">Weekly Progress</Title>
          <Paper withBorder p="lg" radius="lg" bg="midnight.9">
            <Group justify="space-between" mb="xs">
              <Text fw={700}>Weekly TSS Target</Text>
              <Text fw={900} c="blue">{loadingMetrics ? "..." : `${weeklyTSS.current} / ${weeklyTSS.target}`}</Text>
            </Group>
            <Box h={12} bg="midnight.7" style={{ borderRadius: 6, overflow: 'hidden' }}>
              <Box h="100%" w={`${Math.min(100, (weeklyTSS.current / weeklyTSS.target) * 100)}%`} bg="blue.6" style={{ transition: 'width 0.5s ease' }} />
            </Box>
          </Paper>

          <Title order={3} mt="xl" mb="md">Training Load Trends (30 Days)</Title>
          <Paper withBorder p="lg" radius="lg" bg="midnight.9">
            <Box h={300}>
              {getPMCChartData() ? <Line data={getPMCChartData()} options={chartOptions} /> : <Text c="dimmed" ta="center" mt="xl">Not enough data to display trends</Text>}
            </Box>
          </Paper>
        </Box>

        <Box>
          <Title order={3} mt="xl" mb="md">Today's Focus</Title>
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
                      borderLeft:
                        item.raceType === 'A'
                          ? '6px solid var(--mantine-color-red-7)'
                          : `4px solid var(--mantine-color-${config.color.split('.')[0]}-${config.color.split('.')[1] || '6'})`,
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
                          {item.raceType === 'A' ? (
                            <IconTrophy size={18} color="white" />
                          ) : (
                            config.icon || <IconCalendarEvent size={18} color="white" />
                          )}
                        </Box>
                        <Stack gap={2}>
                          <Text fw={900} size="sm">
                            {item.raceType === 'A' && '🏆 '}{item.plannedActivity}
                          </Text>
                          <Text size="xs" c="dimmed" lineClamp={1}>{item.details}</Text>
                        </Stack>
                      </Group>

                      {item.status === 'done' ? (
                        <Badge color="green" variant="filled" size="sm" leftSection={<IconCheck size={12} />}>
                          Done
                        </Badge>
                      ) : (
                        <Button
                          variant="subtle"
                          size="compact-xs"
                          onClick={() => navigate('/planner')}
                        >
                          Start
                        </Button>
                      )}
                    </Group>
                  </Paper>
                );
              })}
            </Stack>
          ) : (
            <Paper p="xl" withBorder radius="lg" bg="midnight.9" style={{ textAlign: 'center' }}>
              <Text c="dimmed">No workouts planned for today.</Text>
              <Button variant="subtle" mt="md" onClick={() => navigate('/planner')}>Go to Planner</Button>
            </Paper>
          )}
          <Title order={3} mb="md">Readiness Score</Title>
          <ReadinessGauge
            score={readinessScore.score}
            label={readinessScore.label}
            color={readinessScore.color}
            tsb={readinessScore.tsb}
            daysSinceLastActivity={readinessScore.daysSinceLastActivity}
          />


        </Box>
      </SimpleGrid>
    </Stack>
  );
}

export default Dashboard;
