import { useState } from 'react';
import Planner from './Planner';
import { samplePlannerData, generateSampleMonth } from '../utils/samplePlannerData';
import {
  Stack,
  Group,
  Title,
  Text,
  Button,
  Paper,
  Textarea,
  Divider,
  Box,
  SimpleGrid,
  rem,
  List,
  ThemeIcon
} from '@mantine/core';
import { IconCheck, IconUpload, IconRefresh, IconFileText, IconCircleCheck } from '@tabler/icons-react';

const PlannerDemo = () => {
  const [csvData, setCsvData] = useState(samplePlannerData);
  const [activeTab, setActiveTab] = useState('sample');

  const handleLoadSample = () => {
    setCsvData(samplePlannerData);
    setActiveTab('sample');
  };

  const handleLoadGenerated = () => {
    const generated = generateSampleMonth(2026, 1, 25);
    setCsvData(generated);
    setActiveTab('generated');
  };

  const handleLoadCustom = (e) => {
    setCsvData(e.target.value);
    setActiveTab('custom');
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setCsvData(event.target.result);
        setActiveTab('uploaded');
      };
      reader.readAsText(file);
    }
  };

  return (
    <Stack gap="xl">
      <Stack gap={0}>
        <Title order={1}>Planner Engine Demo</Title>
        <Text c="dimmed">Test and validate the training planner with sample or custom datasets</Text>
      </Stack>

      <SimpleGrid cols={{ base: 1, md: 2 }} spacing="xl">
        <Stack gap="lg">
          <Paper withBorder p="lg" radius="lg" bg="midnight.9">
            <Title order={3} mb="md" size="h5">Dataset Controls</Title>
            <Group>
              <Button
                variant={activeTab === 'sample' ? 'filled' : 'light'}
                onClick={handleLoadSample}
                leftSection={<IconFileText size={16} />}
              >
                Sample Data
              </Button>
              <Button
                variant={activeTab === 'generated' ? 'filled' : 'light'}
                onClick={handleLoadGenerated}
                leftSection={<IconRefresh size={16} />}
              >
                Randomize
              </Button>
              <label style={{ cursor: 'pointer' }}>
                <Button component="div" variant="light" leftSection={<IconUpload size={16} />}>
                  Upload CSV
                </Button>
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleFileUpload}
                  style={{ display: 'none' }}
                />
              </label>
            </Group>

            <Divider my="xl" label="Raw CSV Editor" labelPosition="center" />

            <Textarea
              label="CSV Source Code"
              description="Edit the raw CSV data below to see live updates in the planner"
              value={csvData}
              onChange={handleLoadCustom}
              rows={8}
              styles={{ input: { fontFamily: 'monospace', fontSize: rem(12) } }}
            />
          </Paper>

          <Paper withBorder p="lg" radius="lg" bg="midnight.9">
            <Title order={3} mb="md" size="h5">Engine Features</Title>
            <List
              spacing="xs"
              size="sm"
              center
              icon={
                <ThemeIcon color="blue" size={20} radius="xl">
                  <IconCircleCheck size={12} />
                </ThemeIcon>
              }
            >
              <List.Item>Month-view calendar with activity tracking</List.Item>
              <List.Item>Color-coded status indicators (Done/Missed/Pending)</List.Item>
              <List.Item>Interactive day-level detail inspection</List.Item>
              <List.Item>Planned vs Actual volume variance analysis</List.Item>
              <List.Item>Dynamic CSV parsing engine with validation</List.Item>
            </List>
          </Paper>
        </Stack>

        <Box>
          <Planner csvData={csvData} />
        </Box>
      </SimpleGrid>
    </Stack>
  );
};

export default PlannerDemo;
