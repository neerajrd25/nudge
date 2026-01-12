import { Box, Text, Stack, Group, RingProgress, rem, Paper } from '@mantine/core';

export function ReadinessGauge({ score, label = 'Optimal', color = 'green', tsb, daysSinceLastActivity }) {
  const getReadinessGuidance = (score) => {
    if (score >= 80) return "Peak condition - push hard or race!";
    if (score >= 65) return "Good recovery - maintain or build intensity";
    if (score >= 50) return "Balanced - focus on quality sessions";
    if (score >= 35) return "Fatigued - prioritize recovery and easy sessions";
    return "Overtrained - take rest days and reduce volume";
  };

  return (
    <Paper withBorder p="xl" radius="lg" bg="midnight.9" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
      <Stack align="center" gap="sm">
        <RingProgress
          size={180}
          thickness={16}
          roundCaps
          sections={[{ value: score, color: color }]}
          label={
            <Stack gap={0} align="center">
              <Text size={rem(32)} fw={900}>{score}%</Text>
              <Text size="xs" fw={700} tt="uppercase" c="dimmed">Readiness</Text>
            </Stack>
          }
        />
        <Stack align="center" gap={4}>
          <Text fw={800} size="lg">{label}</Text>
          <Text size="xs" c="dimmed" ta="center">Based on training load, TSB, and recovery patterns</Text>
          
          {/* Additional metrics and guidance */}
          <Stack gap={2} mt="xs">
            {tsb !== undefined && (
              <Text size="xs" c="dimmed" ta="center">
                Current TSB: <Text component="span" fw={600} c={tsb > 0 ? 'green.4' : tsb < 0 ? 'red.4' : 'yellow.4'}>
                  {tsb > 0 ? '+' : ''}{tsb}
                </Text>
              </Text>
            )}
            {daysSinceLastActivity !== undefined && (
              <Text size="xs" c="dimmed" ta="center">
                Days since last activity: {daysSinceLastActivity}
              </Text>
            )}
            <Text size="xs" c="dimmed" ta="center" mt={4}>
              {getReadinessGuidance(score)}
            </Text>
          </Stack>
          
          {/* Readiness ranges reference */}
          <Stack gap={1} mt="xs">
            <Text size="xs" c="dimmed" ta="center" fw={600}>Readiness Ranges:</Text>
            <Group gap="xs" justify="center" wrap="wrap">
              <Text size="xs" c="green.4">80-100: Peak Ready</Text>
              <Text size="xs" c="blue.4">65-79: Good Recovery</Text>
              <Text size="xs" c="yellow.4">50-64: Maintaining</Text>
              <Text size="xs" c="orange.4">35-49: Fatigued</Text>
              <Text size="xs" c="red.4">0-34: Overtrained</Text>
            </Group>
          </Stack>
        </Stack>
      </Stack>
    </Paper>
  );
}
