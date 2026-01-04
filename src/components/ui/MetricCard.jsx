import { Paper, Text, Group, Stack, Badge, Box, rem } from '@mantine/core';
import { IconArrowUpRight, IconArrowDownRight, IconMinus } from '@tabler/icons-react';

export function MetricCard({ title, value, unit, trend, trendValue, description, color = 'blue' }) {
  const TrendIcon = trend === 'up' ? IconArrowUpRight : trend === 'down' ? IconArrowDownRight : IconMinus;
  const trendColor = trend === 'up' ? 'green' : trend === 'down' ? 'red' : 'gray';

  return (
    <Paper withBorder p="lg" radius="lg" bg="midnight.9" style={{ position: 'relative', overflow: 'hidden' }}>
      <Stack gap="xs">
        <Group justify="space-between">
          <Text size="xs" fw={900} tt="uppercase" c="dimmed">{title}</Text>
          {trend && (
            <Badge
              variant="light"
              color={trendColor}
              leftSection={<TrendIcon size={12} />}
              size="xs"
            >
              {trendValue}
            </Badge>
          )}
        </Group>

        <Group align="flex-end" gap={4}>
          <Text size={rem(32)} fw={900} style={{ lineHeight: 1 }}>{value}</Text>
          {unit && <Text size="sm" fw={700} c="dimmed" mb={4}>{unit}</Text>}
        </Group>

        {description && (
          <Text size="xs" c="dimmed" lineClamp={1}>
            {description}
          </Text>
        )}
      </Stack>

      <Box
        style={{
          position: 'absolute',
          right: rem(-15),
          bottom: rem(-15),
          opacity: 0.03,
          color: `var(--mantine-color-${color}-filled)`
        }}
      >
        <TrendIcon size={80} />
      </Box>
    </Paper>
  );
}
