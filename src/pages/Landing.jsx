import { useNavigate } from 'react-router-dom';
import {
  Title,
  Text,
  Button,
  Group,
  Stack,
  SimpleGrid,
  Box,
  rem,
  Badge,
  Container,
} from '@mantine/core';
import { useAuth } from '../context/AuthContext';
import {
  IconTrophy,
  IconCalendarEvent,
  IconMessageChatbot,
  IconActivity
} from '@tabler/icons-react';

import { Carousel } from '@mantine/carousel';

export function Landing() {
  const navigate = useNavigate();
  const { athlete, isAuthenticated, login } = useAuth();

  const slides = [
    {
      title: 'Build Your Momentum.',
      highlight: 'The Intelligence Platform for Athletes',
      desc: 'Professional-grade performance management and recovery analysis. Connect your Strava account to unlock advanced physiological insights.',
      image: 'radial-gradient(circle, rgba(33, 154, 240, 0.15) 0%, rgba(0,0,0,0) 70%)',
      screenshot: '/app_images/Fitness_dashboard.png'
    },
    {
      title: 'Smart Scheduling',
      highlight: 'Train Smarter, Not Harder',
      desc: 'Dynamic scheduling with automated Strava activity matching and variance tracking to keep you on peak performance.',
      image: 'radial-gradient(circle, rgba(76, 230, 166, 0.15) 0%, rgba(0,0,0,0) 70%)',
      screenshot: '/app_images/planner.png'
    },
    {
      title: 'Deep Analytics',
      highlight: 'Unlock Your Potential',
      desc: 'Track TSS, CTL, and Fatigue trends with elite-level precision. Visualize your progress like never before.',
      image: 'radial-gradient(circle, rgba(144, 146, 255, 0.15) 0%, rgba(0,0,0,0) 70%)',
      screenshot: '/app_images/fitness_analytics.png'
    },
    {
      title: 'AI Training Coach',
      highlight: 'Your Personal Performance Analyst',
      desc: 'Get personalized recovery advice, performance insights, and training recommendations driven by your data.',
      image: 'radial-gradient(circle, rgba(255, 140, 0, 0.15) 0%, rgba(0,0,0,0) 70%)',
      screenshot: '/app_images/ai_coach.png'
    }
  ];

  return (
    <Box className="home-content">
      <Stack gap={0}>
        {/* Full Width Hero Carousel */}
        <Box>
          <Carousel
            withIndicators
            height="90vh"
            loop
            classNames={{
              root: 'hero-carousel',
              controls: 'hero-carousel-controls',
              indicator: 'hero-carousel-indicator'
            }}
            styles={{
              indicator: {
                width: rem(12),
                height: rem(4),
                transition: 'width 250ms ease',
                '&[data-active]': {
                  width: rem(40),
                },
              },
              control: {
                '&[data-inactive]': {
                  opacity: 0,
                  cursor: 'default',
                },
              },
            }}
          >
            {slides.map((slide, index) => (
              <Carousel.Slide key={index}>
                <Box style={{ height: '100%', position: 'relative', overflow: 'hidden' }}>
                  {/* Background Gradient */}
                  <Box
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      right: 0,
                      bottom: 0,
                      background: slide.image,
                      zIndex: 0
                    }}
                  />

                  <Container size="xl" h="100%" style={{ position: 'relative', zIndex: 1 }}>
                    <SimpleGrid cols={{ base: 1, md: 2 }} spacing={rem(60)} verticalSpacing={rem(40)} h="100%">
                      <Stack justify="center" gap="xl" style={{ height: '100%', zIndex: 2 }}>
                        <Group gap="xs">
                          <img
                            src="/momentum_iq.png"
                            alt="Momentum.IQ logo"
                            style={{ height: rem(48), borderRadius: rem(10) }}
                          />
                          <Badge
                            variant="gradient"
                            gradient={{ from: 'blue', to: 'cyan' }}
                            size="lg"
                            radius="sm"
                          >
                            Beta v2.0
                          </Badge>
                        </Group>

                        <Title order={1} className="hero-title" style={{ fontSize: rem(64), lineHeight: 1.1, fontWeight: 900, letterSpacing: '-2px' }}>
                          {slide.title} <br />
                          <span style={{
                            background: 'linear-gradient(45deg, #4DABF7 0%, #339AF0 100%)',
                            WebkitBackgroundClip: 'text',
                            WebkitTextFillColor: 'transparent'
                          }}>
                            {slide.highlight}
                          </span>
                        </Title>
                        <Text size="xl" c="dimmed" style={{ maxWidth: rem(540), lineHeight: 1.6, fontSize: rem(20) }}>
                          {slide.desc}
                        </Text>

                        <Group gap="md">
                          <Button
                            onClick={login}
                            size="lg"
                            h={rem(54)}
                            style={{
                              background: '#fc4c02',
                              padding: `${rem(8)} ${rem(24)}`,
                              borderRadius: rem(8),
                              display: 'flex',
                              alignItems: 'center',
                              gap: rem(12),
                              transition: 'transform 0.15s ease',
                              boxShadow: '0 4px 12px rgba(252, 76, 2, 0.3)'
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
                            h={rem(54)}
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

                      <Box visibleFrom="md" style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Box
                          style={{
                            position: 'relative',
                            width: '100%',
                            transform: 'perspective(1000px) rotateY(-10deg) rotateX(5deg)',
                            transition: 'transform 0.3s ease',
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.transform = 'perspective(1000px) rotateY(-5deg) rotateX(2deg) scale(1.02)'}
                          onMouseLeave={(e) => e.currentTarget.style.transform = 'perspective(1000px) rotateY(-10deg) rotateX(5deg)'}
                        >
                          <img
                            src={slide.screenshot}
                            alt={slide.title}
                            style={{
                              width: '100%',
                              height: 'auto',
                              borderRadius: rem(12),
                              boxShadow: '0 30px 60px rgba(0,0,0,0.5)',
                              border: '1px solid rgba(255,255,255,0.1)'
                            }}
                          />
                        </Box>
                      </Box>
                    </SimpleGrid>
                  </Container>
                </Box>
              </Carousel.Slide>
            ))}
          </Carousel>
        </Box>

        {/* Features Section */}
        <Box id="features" py={rem(120)} bg="midnight.9">
          <Container size="xl">
            <Stack gap={rem(160)}>
              {/* Feature 1: Planner */}
              <SimpleGrid cols={{ base: 1, md: 2 }} spacing={rem(80)} verticalSpacing={rem(40)}>
                <Box style={{ display: 'flex', alignItems: 'center' }}>
                  <Stack gap="lg">
                    <Group gap="xs" c="blue.4">
                      <IconCalendarEvent size={28} />
                      <Text fw={700} tt="uppercase" ls={1}>Smart Scheduling</Text>
                    </Group>
                    <Title order={2} size={rem(42)}>
                      Align Your Training with Reality
                    </Title>
                    <Text size="lg" c="dimmed" lh={1.7}>
                      Stop fighting your calendar. Precision Planner automatically syncs with your Strava activities, matching planned workouts with actual execution.
                      <br /><br />
                      Visualize your weekly volume, track compliance, and adjust on the fly. Whether you're targeting a PR or building base fitness, our dynamic schedule adapts to your life, keeping your momentum consistent properly.
                    </Text>
                    <Button
                      variant="light"
                      color="blue"
                      size="md"
                      radius="md"
                      w="fit-content"
                      mt="md"
                      rightSection={<IconTrophy size={18} />}
                      onClick={() => navigate('/planner')}
                    >
                      Start Planning
                    </Button>
                  </Stack>
                </Box>
                <Box style={{ position: 'relative' }}>
                  <Box
                    style={{
                      position: 'absolute',
                      inset: -20,
                      background: 'radial-gradient(circle, rgba(51, 154, 240, 0.1) 0%, rgba(0,0,0,0) 70%)',
                      borderRadius: '50%',
                      filter: 'blur(40px)',
                      zIndex: 0
                    }}
                  />
                  <img
                    src="/app_images/planner.png"
                    alt="Planner Interface"
                    style={{
                      width: '100%',
                      borderRadius: rem(16),
                      border: '1px solid rgba(255,255,255,0.1)',
                      boxShadow: '0 24px 48px rgba(0,0,0,0.4)',
                      position: 'relative',
                      zIndex: 1
                    }}
                  />
                </Box>
              </SimpleGrid>

              {/* Feature 2: Analytics - Reversed Layout */}
              <SimpleGrid cols={{ base: 1, md: 2 }} spacing={rem(80)} verticalSpacing={rem(40)}>
                <Box visibleFrom="md" style={{ position: 'relative' }}>
                  <Box
                    style={{
                      position: 'absolute',
                      inset: -20,
                      background: 'radial-gradient(circle, rgba(81, 207, 102, 0.1) 0%, rgba(0,0,0,0) 70%)',
                      borderRadius: '50%',
                      filter: 'blur(40px)',
                      zIndex: 0
                    }}
                  />
                  <img
                    src="/app_images/fitness_analytics.png"
                    alt="Analytics Dashboard"
                    style={{
                      width: '100%',
                      borderRadius: rem(16),
                      border: '1px solid rgba(255,255,255,0.1)',
                      boxShadow: '0 24px 48px rgba(0,0,0,0.4)',
                      position: 'relative',
                      zIndex: 1
                    }}
                  />
                </Box>
                <Box style={{ display: 'flex', alignItems: 'center' }}>
                  <Stack gap="lg">
                    <Group gap="xs" c="green.4">
                      <IconActivity size={28} />
                      <Text fw={700} tt="uppercase" ls={1}>Deep Analytics</Text>
                    </Group>
                    <Title order={2} size={rem(42)}>
                      Decode Your Physiology
                    </Title>
                    <Text size="lg" c="dimmed" lh={1.7}>
                      Go beyond simple distance and pace. Momentum.IQ breaks down your performance into Fitness (CTL), Fatigue (ATL), and Form (TSB) metrics.
                      <br /><br />
                      Understand exactly how your body is responding to training load. Identify peak windows, avoid burnout, and make data-driven decisions that lead to consistent breakthroughs.
                    </Text>
                    <Button
                      variant="light"
                      color="green"
                      size="md"
                      radius="md"
                      w="fit-content"
                      mt="md"
                      rightSection={<IconActivity size={18} />}
                      onClick={() => navigate('/charts')}
                    >
                      Explore Charts
                    </Button>
                  </Stack>
                </Box>
                <Box hiddenFrom="md"> {/* Mobile Image */}
                  <img
                    src="/app_images/fitness_analytics.png"
                    alt="Analytics Dashboard"
                    style={{
                      width: '100%',
                      borderRadius: rem(16),
                      border: '1px solid rgba(255,255,255,0.1)',
                      boxShadow: '0 24px 48px rgba(0,0,0,0.4)'
                    }}
                  />
                </Box>
              </SimpleGrid>

              {/* Feature 3: AI Coach */}
              <SimpleGrid cols={{ base: 1, md: 2 }} spacing={rem(80)} verticalSpacing={rem(40)}>
                <Box style={{ display: 'flex', alignItems: 'center' }}>
                  <Stack gap="lg">
                    <Group gap="xs" c="violet.4">
                      <IconMessageChatbot size={28} />
                      <Text fw={700} tt="uppercase" ls={1}>AI Coach</Text>
                    </Group>
                    <Title order={2} size={rem(42)}>
                      Expert Guidance in Your Pocket
                    </Title>
                    <Text size="lg" c="dimmed" lh={1.7}>
                      Need a recovery strategy? Wondering about your pace zones? Our AI Training Coach analyzes your specific historical data to provide personalized, context-aware advice.
                      <br /><br />
                      It’s like having an elite coach review every workout. Get instant feedback on your progress and actionable tips to optimize your next session.
                    </Text>
                    <Button
                      variant="light"
                      color="violet"
                      size="md"
                      radius="md"
                      w="fit-content"
                      mt="md"
                      rightSection={<IconMessageChatbot size={18} />}
                      onClick={() => navigate('/chat')}
                    >
                      Chat with Coach
                    </Button>
                  </Stack>
                </Box>
                <Box style={{ position: 'relative' }}>
                  <Box
                    style={{
                      position: 'absolute',
                      inset: -20,
                      background: 'radial-gradient(circle, rgba(132, 94, 247, 0.1) 0%, rgba(0,0,0,0) 70%)',
                      borderRadius: '50%',
                      filter: 'blur(40px)',
                      zIndex: 0
                    }}
                  />
                  <img
                    src="/app_images/ai_coach.png"
                    alt="AI Coach Interface"
                    style={{
                      width: '100%',
                      borderRadius: rem(16),
                      border: '1px solid rgba(255,255,255,0.1)',
                      boxShadow: '0 24px 48px rgba(0,0,0,0.4)',
                      position: 'relative',
                      zIndex: 1
                    }}
                  />
                </Box>
              </SimpleGrid>
            </Stack>
          </Container>
        </Box>
      </Stack>
    </Box>
  );
}

export default Landing;
