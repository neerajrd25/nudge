import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Container,
  Stack,
  Group,
  Title,
  Text,
  Button,
  TextInput,
  Paper,
  Avatar,
  ScrollArea,
  Select,
  Badge,
  rem,
  Box,
  ActionIcon,
  Tooltip,
  Paper as MantinePaper,
  Alert,
} from '@mantine/core';
import {
  getStoredAuthData,
  getAthleteActivities,
  refreshAccessToken,
  storeAuthData,
  isTokenExpired
} from '../utils/stravaApi';
import { sendChatMessage, listModels, checkOllamaHealth } from '../utils/ollamaApi';

function Chat() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [ollamaStatus, setOllamaStatus] = useState('checking');
  const [selectedModel, setSelectedModel] = useState('llama2');
  const [availableModels, setAvailableModels] = useState([]);
  const [activities, setActivities] = useState([]);
  const viewport = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    checkOllamaConnection();
    loadActivitiesForContext();
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    viewport.current?.scrollTo({ top: viewport.current.scrollHeight, behavior: 'smooth' });
  };

  const checkOllamaConnection = async () => {
    try {
      const isHealthy = await checkOllamaHealth();
      if (isHealthy) {
        setOllamaStatus('connected');
        const models = await listModels();
        setAvailableModels(models.map(m => ({ value: m.name, label: m.name })));
        if (models.length > 0) setSelectedModel(models[0].name);
      } else {
        setOllamaStatus('disconnected');
      }
    } catch (err) {
      setOllamaStatus('disconnected');
    }
  };

  const loadActivitiesForContext = async () => {
    try {
      const authData = getStoredAuthData();
      if (!authData?.accessToken) return;
      let accessToken = authData.accessToken;
      if (isTokenExpired() && authData.refreshToken) {
        const newAuthData = await refreshAccessToken(authData.refreshToken);
        storeAuthData(newAuthData);
        accessToken = newAuthData.access_token;
      }
      const data = await getAthleteActivities(accessToken, 1, 10);
      setActivities(data);
    } catch (err) { console.error(err); }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!input.trim() || loading || ollamaStatus !== 'connected') return;

    const userMessage = { role: 'user', content: input.trim() };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      const systemMessage = {
        role: 'system',
        content: `You are a helpful AI training assistant. Analysis: ${activities.map(a => `- ${a.name}: ${(a.distance / 1000).toFixed(2)}km`).join('\n')}`,
      };
      const messagesToSend = [systemMessage, ...messages, userMessage];

      let assistantMessage = { role: 'assistant', content: '' };
      setMessages(prev => [...prev, assistantMessage]);

      await sendChatMessage(selectedModel, messagesToSend, (chunk) => {
        assistantMessage.content += chunk;
        setMessages(prev => {
          const newMessages = [...prev];
          newMessages[newMessages.length - 1] = { ...assistantMessage };
          return newMessages;
        });
      });
    } catch (error) {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Connection error. Is Ollama running?' }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Stack gap="md" h="calc(100vh - 120px)">
      <Group justify="space-between">
        <Title order={1}>AI Coach</Title>
        <Group>
          <Badge
            color={ollamaStatus === 'connected' ? 'green' : ollamaStatus === 'checking' ? 'yellow' : 'red'}
            variant="dot"
          >
            {ollamaStatus === 'connected' ? 'IQ Active' : 'Ollama Offline'}
          </Badge>
          {ollamaStatus === 'connected' && (
            <Select
              size="xs"
              data={availableModels}
              value={selectedModel}
              onChange={setSelectedModel}
              placeholder="Model"
              style={{ width: rem(100) }}
            />
          )}
        </Group>
      </Group>

      <Paper withBorder radius="lg" p={0} style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', backgroundColor: 'var(--mantine-color-midnight-9)' }}>
        <ScrollArea viewportRef={viewport} style={{ flex: 1 }} p="md">
          {messages.length === 0 && (
            <Stack align="center" gap="lg" py={rem(80)}>
              <Text size="60px">🤖</Text>
              <Title order={2} ta="center" fw={900}>Personalized Intelligence</Title>
              <Text size="sm" c="dimmed" ta="center">Ask for recovery advice or workout analysis.</Text>
              <Group justify="center">
                <Button variant="outline" size="xs" color="blue" onClick={() => setInput('Analyze my last 5 runs')}>Last 5 runs</Button>
                <Button variant="outline" size="xs" color="blue" onClick={() => setInput('Should I rest today?')}>Rest advice</Button>
                <Button variant="outline" size="xs" color="blue" onClick={() => setInput('Suggest a 5k interval workout')}>5k workout</Button>
              </Group>
            </Stack>
          )}

          <Stack gap="md">
            {messages.map((message, index) => (
              <Group
                key={index}
                align="flex-start"
                justify={message.role === 'user' ? 'flex-end' : 'flex-start'}
                gap="xs"
              >
                {message.role !== 'user' && <Avatar color="blue" radius="xl" size="sm">IQ</Avatar>}
                <MantinePaper
                  p="sm"
                  radius="md"
                  bg={message.role === 'user' ? 'blue.7' : 'midnight.7'}
                  c={message.role === 'user' ? 'white' : 'inherit'}
                  style={{ maxWidth: '80%', border: 'none' }}
                >
                  <Text size="sm" style={{ whiteSpace: 'pre-wrap' }}>{message.content}</Text>
                </MantinePaper>
                {message.role === 'user' && <Avatar color="midnight.4" radius="xl" size="sm">ME</Avatar>}
              </Group>
            ))}
          </Stack>
        </ScrollArea>

        <Box p="md" bg="midnight.8" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
          <form onSubmit={handleSubmit}>
            <Group gap="xs">
              <TextInput
                placeholder="Ask about your performance..."
                style={{ flex: 1 }}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                disabled={loading || ollamaStatus !== 'connected'}
                radius="md"
              />
              <Button type="submit" loading={loading} disabled={!input.trim() || ollamaStatus !== 'connected'} radius="md">
                Send
              </Button>
            </Group>
          </form>
        </Box>
      </Paper>

      {ollamaStatus === 'disconnected' && (
        <Alert color="red" title="Local AI Offline" variant="light" icon="⚠️">
          Ollama not detected. Start with <code>ollama serve</code> for AI Coach.
        </Alert>
      )}
    </Stack>
  );
}

export default Chat;
