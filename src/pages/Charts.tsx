import { useState, useRef, useMemo } from 'react';
import {
  Container,
  Title,
  Text,
  Paper,
  Grid,
  Stack,
  Group,
  Button,
  Loader,
  Alert,
  Table,
  Badge,
  NumberInput,
  Card,
  SimpleGrid,
  Box,
  rem,
  Divider,
} from '@mantine/core';
import {
  IconDownload,
  IconTrendingUp,
  IconTrendingDown,
  IconMinus,
  IconActivity,
  IconHeart,
  IconRun,
} from '@tabler/icons-react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title as ChartTitle,
  Tooltip as ChartTooltip,
  Legend,
  ScatterController,
  LineController,
  Filler,
} from 'chart.js';
import { Line, Scatter } from 'react-chartjs-2';
import { toPng } from 'html-to-image';
import { useFitnessData } from '../hooks/useFitnessData';
import { getStoredAuthData } from '../utils/stravaApi';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  ScatterController,
  LineController,
  ChartTitle,
  ChartTooltip,
  Legend,
  Filler
);

const Charts = () => {
  const authData = getStoredAuthData();
  const athleteId = authData?.athlete?.id?.toString() || null;
  const { vizData, loading, error, filters, setFilters, stats, recentRuns, trendLine, efficiencyTrend, frontierData } =
    useFitnessData(athleteId);

  const chartRef = useRef<HTMLDivElement>(null);
  const [exporting, setExporting] = useState(false);

  // Handle export to PNG
  const handleExport = async () => {
    if (!chartRef.current) return;
    
    setExporting(true);
    try {
      const dataUrl = await toPng(chartRef.current, {
        quality: 1.0,
        pixelRatio: 2,
        backgroundColor: '#0a0a0a', // Match midnight theme
      });
      
      const link = document.createElement('a');
      link.download = `fitness-viz-${new Date().toISOString().split('T')[0]}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error('Export failed:', err);
    } finally {
      setExporting(false);
    }
  };

  // Format pace for display
  const formatPace = (pace: number): string => {
    const minutes = Math.floor(pace);
    const seconds = Math.round((pace - minutes) * 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  // Format date
  const formatDate = (date: Date): string => {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  // Color scale for scatter plot (oldest blue -> newest red)
  const getColorByDate = (date: Date): string => {
    if (vizData.length === 0) return '#4299e1';
    
    const oldestTime = Math.min(...vizData.map((d) => d.date.getTime()));
    const newestTime = Math.max(...vizData.map((d) => d.date.getTime()));
    const range = newestTime - oldestTime;
    
    if (range === 0) return '#4299e1';
    
    const ratio = (date.getTime() - oldestTime) / range;
    
    // Interpolate from blue to red
    const r = Math.round(66 + ratio * (239 - 66));
    const g = Math.round(153 - ratio * (153 - 68));
    const b = Math.round(225 - ratio * (225 - 68));
    
    return `rgb(${r}, ${g}, ${b})`;
  };

  // GAP Trend Chart Data
  const trendChartData = useMemo(() => {
    const sorted = [...vizData].sort((a, b) => a.date.getTime() - b.date.getTime());
    
    return {
      labels: sorted.map(d => formatDate(d.date)),
      datasets: [
        {
          label: 'GAP (min/km)',
          data: sorted.map(d => d.gap),
          borderColor: '#4299e1',
          backgroundColor: 'rgba(66, 153, 225, 0.1)',
          borderWidth: 3,
          tension: 0.3,
          pointRadius: 4,
          pointBackgroundColor: '#4299e1',
          fill: true,
        },
        ...(trendLine ? [{
          label: 'Overall Trend',
          data: trendLine.map(d => d.trend),
          borderColor: '#f56565',
          borderWidth: 2,
          borderDash: [5, 5],
          pointRadius: 0,
          fill: false,
        }] : [])
      ]
    };
  }, [vizData, trendLine]);

  // Efficiency Trend Chart Data
  const effChartData = useMemo(() => {
    const sorted = [...vizData].sort((a, b) => a.date.getTime() - b.date.getTime());
    
    return {
      labels: sorted.map(d => formatDate(d.date)),
      datasets: [
        {
          label: 'Aerobic Efficiency (Speed/HR)',
          data: sorted.map(d => d.efficiency),
          borderColor: '#48bb78',
          backgroundColor: 'rgba(72, 187, 120, 0.1)',
          borderWidth: 3,
          tension: 0.3,
          pointRadius: 4,
          pointBackgroundColor: '#48bb78',
          fill: true,
        },
        ...(efficiencyTrend ? [{
          label: 'Overall Trend',
          data: efficiencyTrend.map(d => d.trend),
          borderColor: '#f56565',
          borderWidth: 2,
          borderDash: [5, 5],
          pointRadius: 0,
          fill: false,
        }] : [])
      ]
    };
  }, [vizData, efficiencyTrend]);

  // Scatter Chart Data
  const scatterChartData = useMemo(() => {
    return {
      datasets: [
        {
          label: 'Runs',
          data: vizData.map(d => ({ x: d.gap, y: d.hr, r: Math.max(3, Math.min(12, d.distanceKm)) })),
          backgroundColor: vizData.map(d => getColorByDate(d.date)),
          borderColor: 'rgba(255, 255, 255, 0.2)',
          borderWidth: 1,
        }
      ]
    };
  }, [vizData]);

  const frontierChartData = useMemo(() => {
    return {
      datasets: [
        {
          label: 'All-Time Frontier',
          data: frontierData.allTime,
          borderColor: '#4299e1',
          borderWidth: 2,
          pointRadius: 3,
          tension: 0.4,
          fill: false,
        },
        {
          label: 'Recent (90d) Frontier',
          data: frontierData.recent,
          borderColor: '#48bb78',
          borderWidth: 3,
          pointRadius: 4,
          tension: 0.4,
          fill: true,
          backgroundColor: 'rgba(72, 187, 120, 0.1)',
        }
      ]
    };
  }, [frontierData]);

  const frontierOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top' as const,
        labels: { color: '#a0aec0', font: { family: 'inherit' } }
      },
      tooltip: {
        callbacks: {
          label: (context: any) => {
            return `Pace: ${formatPace(context.parsed.x)}/km, Eff: ${context.parsed.y.toFixed(2)}`;
          }
        }
      }
    },
    scales: {
      x: {
        type: 'linear' as const,
        reverse: true,
        title: { display: true, text: 'Pace (min/km)', color: '#a0aec0' },
        ticks: { 
          color: '#a0aec0',
          callback: (value: any) => formatPace(value)
        },
        grid: { color: 'rgba(255, 255, 255, 0.1)' }
      },
      y: {
        title: { display: true, text: 'Peak Efficiency', color: '#a0aec0' },
        ticks: { color: '#a0aec0' },
        grid: { color: 'rgba(255, 255, 255, 0.1)' }
      }
    }
  };

  const lineOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top' as const,
        labels: {
          color: '#a0aec0',
          font: { family: 'inherit' }
        }
      },
      tooltip: {
        callbacks: {
          label: (context: any) => {
            return `GAP: ${formatPace(context.parsed.y)}/km`;
          }
        }
      }
    },
    scales: {
      y: {
        reverse: true, // Lower GAP is better
        grid: { color: 'rgba(255, 255, 255, 0.1)' },
        ticks: { 
          color: '#a0aec0',
          callback: (value: any) => `${formatPace(value)}/km`
        },
        title: {
          display: true,
          text: 'Pace (min/km)',
          color: '#a0aec0'
        }
      },
      x: {
        grid: { display: false },
        ticks: { color: '#a0aec0' }
      }
    }
  };

  const effOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top' as const,
        labels: {
          color: '#a0aec0',
          font: { family: 'inherit' }
        }
      },
      tooltip: {
        callbacks: {
          label: (context: any) => {
            return `Efficiency: ${context.parsed.y.toFixed(2)}`;
          }
        }
      }
    },
    scales: {
      y: {
        reverse: false, // Higher efficiency is better
        grid: { color: 'rgba(255, 255, 255, 0.1)' },
        ticks: { 
          color: '#a0aec0',
        },
        title: {
          display: true,
          text: 'Efficiency Factor (Speed/HR)',
          color: '#a0aec0'
        }
      },
      x: {
        grid: { display: false },
        ticks: { color: '#a0aec0' }
      }
    }
  };

  const scatterOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (context: any) => {
            const dataPoint = vizData[context.dataIndex];
            return [
              `${dataPoint.runName}`,
              `GAP: ${formatPace(dataPoint.gap)}/km`,
              `HR: ${dataPoint.hr} bpm`,
              `Distance: ${dataPoint.distanceKm.toFixed(2)} km`
            ];
          }
        }
      }
    },
    scales: {
      x: {
        reverse: true,
        title: { display: true, text: 'Grade-Adjusted Pace (min/km)', color: '#a0aec0' },
        grid: { color: 'rgba(255, 255, 255, 0.1)' },
        ticks: { 
          color: '#a0aec0',
          callback: (value: any) => `${formatPace(value)}`
        }
      },
      y: {
        title: { display: true, text: 'Average Heart Rate (bpm)', color: '#a0aec0' },
        grid: { color: 'rgba(255, 255, 255, 0.1)' },
        ticks: { color: '#a0aec0' }
      }
    }
  };

  if (loading) {
    return (
      <Container size="xl" py="xl">
        <Stack align="center" justify="center" style={{ minHeight: '60vh' }}>
          <Loader size="xl" color="blue" />
          <Text c="dimmed">Loading fitness insights...</Text>
        </Stack>
      </Container>
    );
  }

  if (error) {
    return (
      <Container size="xl" py="xl">
        <Alert color="red" title="Error loading data" variant="filled">
          {error}
        </Alert>
      </Container>
    );
  }

  if (!athleteId) {
    return (
      <Container size="xl" py="xl">
        <Alert color="yellow" title="Not connected" variant="light">
          Please connect your Strava account to view fitness analytics.
        </Alert>
      </Container>
    );
  }

  return (
    <Container size="xl" py="xl">
      <Stack gap="xl">
        {/* Header Section */}
        <Paper 
          withBorder 
          p="xl" 
          radius="lg" 
          bg="midnight.9"
          style={{
            background: 'linear-gradient(135deg, rgba(66, 153, 225, 0.05) 0%, rgba(0, 0, 0, 0) 100%)',
            borderColor: 'rgba(66, 153, 225, 0.2)'
          }}
        >
          <Group justify="space-between" align="center">
            <Stack gap={0}>
              <Title order={1} style={{ letterSpacing: '-0.5px' }}>
                Fitness <span style={{ color: 'var(--mantine-color-blue-4)' }}>Analytics</span>
              </Title>
              <Text c="dimmed" size="sm">
                Advanced performance management using Grade-Adjusted Pace (GAP)
              </Text>
            </Stack>
            <Button
              leftSection={<IconDownload size={18} />}
              onClick={handleExport}
              loading={exporting}
              variant="gradient"
              gradient={{ from: 'blue.6', to: 'cyan.6' }}
              radius="md"
            >
              Export Analytics
            </Button>
          </Group>
        </Paper>

        {/* Stats Cards */}
        <SimpleGrid cols={{ base: 1, sm: 2, md: 4 }} spacing="lg">
          <Card withBorder radius="lg" p="lg" bg="midnight.9">
            <Stack gap="xs">
              <Group justify="space-between">
                <Text size="xs" c="dimmed" fw={700} tt="uppercase">Total Volume</Text>
                <IconRun size={20} color="var(--mantine-color-blue-4)" />
              </Group>
              <Group align="baseline" gap={4}>
                <Text size="xl" fw={900}>{stats.totalRuns}</Text>
                <Text size="sm" c="dimmed" fw={500}>Runs</Text>
              </Group>
              <Text size="xs" c="dimmed">
                {stats.totalDistance.toFixed(1)} km lifetime distance
              </Text>
            </Stack>
          </Card>

          <Card withBorder radius="lg" p="lg" bg="midnight.9">
            <Stack gap="xs">
              <Group justify="space-between">
                <Text size="xs" c="dimmed" fw={700} tt="uppercase">Average GAP</Text>
                <IconActivity size={20} color="var(--mantine-color-green-4)" />
              </Group>
              <Group align="baseline" gap={4}>
                <Text size="xl" fw={900}>{formatPace(stats.avgGap)}</Text>
                <Text size="sm" c="dimmed" fw={500}>/km</Text>
              </Group>
              <Text size="xs" c="dimmed">
                Personal Best: {formatPace(stats.bestGap)}/km
              </Text>
            </Stack>
          </Card>

          <Card withBorder radius="lg" p="lg" bg="midnight.9">
            <Stack gap="xs">
              <Group justify="space-between">
                <Text size="xs" c="dimmed" fw={700} tt="uppercase">Cardio Load</Text>
                <IconHeart size={20} color="var(--mantine-color-red-4)" />
              </Group>
              <Group align="baseline" gap={4}>
                <Text size="xl" fw={900}>{Math.round(stats.avgHr)}</Text>
                <Text size="sm" c="dimmed" fw={500}>bpm</Text>
              </Group>
              <Text size="xs" c="dimmed">
                Avg Efficiency: {stats.avgEfficiency.toFixed(2)} (Speed/HR)
              </Text>
            </Stack>
          </Card>

          <Card withBorder radius="lg" p="lg" bg="midnight.9">
            <Stack gap="xs">
              <Group justify="space-between">
                <Text size="xs" c="dimmed" fw={700} tt="uppercase">Performance Trend</Text>
                {stats.recentTrend === 'improving' ? (
                  <IconTrendingUp size={20} color="var(--mantine-color-green-4)" />
                ) : stats.recentTrend === 'declining' ? (
                  <IconTrendingDown size={20} color="var(--mantine-color-red-4)" />
                ) : (
                  <IconMinus size={20} color="var(--mantine-color-gray-4)" />
                )}
              </Group>
              <Text size="xl" fw={900} tt="capitalize" c={stats.recentTrend === 'improving' ? 'green.4' : stats.recentTrend === 'declining' ? 'red.4' : 'gray.4'}>
                {stats.recentTrend}
              </Text>
              <Text size="xs" c="dimmed">
                Based on last 10 sessions
              </Text>
            </Stack>
          </Card>
        </SimpleGrid>

        {/* Filters */}
        <Paper p="lg" withBorder radius="lg" bg="midnight.9">
          <Group justify="space-between">
            <Group gap="xl">
              <Group gap="xs">
                <Text size="sm" fw={700}>Distance Range:</Text>
                <NumberInput
                  size="xs"
                  style={{ width: 80 }}
                  value={filters.minDistance}
                  onChange={(val) => setFilters({ ...filters, minDistance: Number(val) || 3 })}
                  min={1}
                  max={filters.maxDistance - 1}
                />
                <Text size="xs" c="dimmed">to</Text>
                <NumberInput
                  size="xs"
                  style={{ width: 80 }}
                  value={filters.maxDistance}
                  onChange={(val) => setFilters({ ...filters, maxDistance: Number(val) || 15 })}
                  min={filters.minDistance + 1}
                  max={50}
                />
                <Text size="xs" c="dimmed">km</Text>
              </Group>
              <Divider orientation="vertical" />
              <Group gap="xs">
                <Text size="xs" fw={700} c="dimmed" tt="uppercase">Quick Presets:</Text>
                <Button.Group>
                  <Button 
                    variant={filters.minDistance === 4.5 && filters.maxDistance === 5.5 ? "filled" : "light"} 
                    size="xs" 
                    onClick={() => setFilters({ ...filters, minDistance: 4.5, maxDistance: 5.5 })}
                  >5km</Button>
                  <Button 
                    variant={filters.minDistance === 9.5 && filters.maxDistance === 10.5 ? "filled" : "light"} 
                    size="xs" 
                    onClick={() => setFilters({ ...filters, minDistance: 9.5, maxDistance: 10.5 })}
                  >10km</Button>
                  <Button 
                    variant={filters.minDistance === 20 && filters.maxDistance === 22 ? "filled" : "light"} 
                    size="xs" 
                    onClick={() => setFilters({ ...filters, minDistance: 20, maxDistance: 22 })}
                  >21km</Button>
                  <Button 
                    variant={filters.minDistance === 3 && filters.maxDistance === 50 ? "filled" : "light"} 
                    size="xs" 
                    onClick={() => setFilters({ ...filters, minDistance: 3, maxDistance: 50 })}
                  >All</Button>
                </Button.Group>
              </Group>
            </Group>
            <Text size="xs" c="dimmed" visibleFrom="md">
              Focus on similar distances to track aerobic efficiency improvements
            </Text>
          </Group>
        </Paper>

        {/* Visualizations */}
        <div ref={chartRef}>
          <Stack gap="xl">
            <SimpleGrid cols={{ base: 1, lg: 2 }} spacing="xl">
              {/* GAP Trend Line Chart */}
              <Paper p="xl" withBorder radius="lg" bg="midnight.9">
                <Stack gap="md" h="100%">
                  <Box>
                    <Title order={4}>Pace Trend (Grade-Adjusted)</Title>
                    <Text size="xs" c="dimmed">Progressive improvements in Grade-Adjusted Pace (GAP)</Text>
                  </Box>
                  <Box style={{ flex: 1, minHeight: 350 }}>
                    <Line data={trendChartData} options={lineOptions} />
                  </Box>
                </Stack>
              </Paper>

              {/* Efficiency Trend Line Chart */}
              <Paper p="xl" withBorder radius="lg" bg="midnight.9">
                <Stack gap="md" h="100%">
                  <Box>
                    <Title order={4}>Aerobic Efficiency Trend</Title>
                    <Text size="xs" c="dimmed">Physiological adaptation: Relationship between speed and heart rate</Text>
                  </Box>
                  <Box style={{ flex: 1, minHeight: 350 }}>
                    <Line data={effChartData} options={effOptions} />
                  </Box>
                </Stack>
              </Paper>
              <Paper p="xl" withBorder radius="lg" bg="midnight.9">
                <Stack gap="md" h="100%">
                  <Box>
                    <Title order={4}>Aerobic Performance Frontier</Title>
                    <Text size="xs" c="dimmed">Peak Efficiency vs Pace: All-Time vs Recent (90d)</Text>
                  </Box>
                  <Box style={{ flex: 1, minHeight: 350 }}>
                    <Line data={frontierChartData} options={frontierOptions} />
                  </Box>
                  <Text size="xs" c="dimmed" fs="italic">
                    This "power-curve" style chart shows the best efficiency achieved at each pace bucket.
                  </Text>
                </Stack>
              </Paper>
            </SimpleGrid>

            {/* Scatter Plot */}
            <Paper p="xl" withBorder radius="lg" bg="midnight.9">
              <Stack gap="md" h="100%">
                <Box>
                  <Title order={4}>Intensity Analysis</Title>
                  <Text size="xs" c="dimmed">Relationship between effort (GAP) and physiological load (HR) across all sessions</Text>
                </Box>
                <Box style={{ flex: 1, minHeight: 400 }}>
                  <Scatter data={scatterChartData} options={scatterOptions} />
                </Box>
                <Group justify="center" gap="xs">
                  <Box w={8} h={8} bg="#4299e1" style={{ borderRadius: '50%' }} />
                  <Text size="xs" c="dimmed">Oldest</Text>
                  <Box w={30} h={2} style={{ background: 'linear-gradient(to right, #4299e1, #f56565)' }} />
                  <Text size="xs" c="dimmed">Newest</Text>
                </Group>
              </Stack>
            </Paper>
          </Stack>
        </div>

        {/* Recent Runs Table */}
        <Paper p="xl" withBorder radius="lg" bg="midnight.9">
          <Stack gap="md">
            <Group justify="space-between">
              <Title order={4}>Recent Intelligence Log</Title>
              <Badge variant="light" color="blue" radius="sm">Last 10 Runs</Badge>
            </Group>
            <div style={{ overflowX: 'auto' }}>
              <Table variant="unstyled" verticalSpacing="sm">
                <Table.Thead style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                  <Table.Tr>
                    <Table.Th><Text size="xs" c="dimmed" tt="uppercase" fw={700}>Date & Name</Text></Table.Th>
                    <Table.Th><Text size="xs" c="dimmed" tt="uppercase" fw={700}>Distance</Text></Table.Th>
                    <Table.Th><Text size="xs" c="dimmed" tt="uppercase" fw={700}>GAP</Text></Table.Th>
                    <Table.Th><Text size="xs" c="dimmed" tt="uppercase" fw={700}>Avg HR</Text></Table.Th>
                    <Table.Th><Text size="xs" c="dimmed" tt="uppercase" fw={700}>Efficiency</Text></Table.Th>
                    <Table.Th ta="right"><Text size="xs" c="dimmed" tt="uppercase" fw={700}>Status</Text></Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {recentRuns.map((run) => (
                    <Table.Tr key={run.activityId} style={{ borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                      <Table.Td>
                        <Stack gap={0}>
                          <Text size="sm" fw={700}>{formatDate(run.date)}</Text>
                          <Text size="xs" c="dimmed" lineClamp={1}>{run.runName}</Text>
                        </Stack>
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm" fw={600}>{run.distanceKm.toFixed(2)} km</Text>
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm" fw={700} c="blue.4">{formatPace(run.gap)}/km</Text>
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm">{run.hr} bpm</Text>
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm" fw={600}>{run.efficiency.toFixed(2)}</Text>
                      </Table.Td>
                      <Table.Td ta="right">
                        {run.improvementPercent !== undefined && (
                          <Badge
                            size="sm"
                            color={run.improvementPercent > 0 ? 'green' : 'red'}
                            variant="light"
                            radius="sm"
                          >
                            {run.improvementPercent > 0 ? '+' : ''}
                            {run.improvementPercent.toFixed(1)}%
                          </Badge>
                        )}
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </div>
          </Stack>
        </Paper>

        {/* Technical Alert */}
        <Alert color="blue" radius="lg" variant="light" title="Intelligence: Grade-Adjusted Pace">
          <Text size="sm">
            NUDGE.IQ uses GAP to normalize your pace against gravity. By adjusting for elevation changes, 
            we can accurately track your aerobic efficiency regardless of the terrain. A declining GAP 
            at the same Heart Rate indicates physiological adaptation and improved fitness.
          </Text>
        </Alert>
      </Stack>
    </Container>
  );
};

export default Charts;
