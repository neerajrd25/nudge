import { Box, Text, Stack, Group, RingProgress, rem, Paper } from '@mantine/core';

export function ReadinessGauge({ score, label = 'Optimal', color = 'green' }) {
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
          <Text size="xs" c="dimmed" ta="center">Based on your sleep, HRV, and recent stress</Text>
        </Stack>
      </Stack>
    </Paper>
  );
}
