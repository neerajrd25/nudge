import { useState, useEffect } from 'react';
import {
  AppShell,
  Box,
  Burger,
  Group,
  NavLink,
  Text,
  Avatar,
  Menu,
  UnstyledButton,
  rem,
  Badge,
  Tooltip,
  Divider,
  Stack,
  Button,
  Container
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  IconDashboard,
  IconActivity,
  IconCalendar,
  IconMessageChatbot,
  IconSettings,
  IconTrophy,
  IconChartBar,
  IconShieldLock,
  IconLogout,
  IconUser,
  IconSmartHome
} from '@tabler/icons-react';
import { getStoredAuthData, clearAuthData } from '../../utils/stravaApi';

export function AppLayout({ children }) {
  const [opened, { toggle }] = useDisclosure();
  const navigate = useNavigate();
  const location = useLocation();
  const [athlete, setAthlete] = useState(null);

  useEffect(() => {
    const authData = getStoredAuthData();
    if (authData?.athlete) {
      setAthlete(authData.athlete);
    }
  }, []);

  const handleLogout = () => {
    clearAuthData();
    navigate('/');
  };

  const navLinks = [
    { label: 'Intelligence', icon: IconSmartHome, path: '/', exact: true },
    { label: 'Activities', icon: IconActivity, path: '/activities' },
    { label: 'Training Plan', icon: IconCalendar, path: '/planner' },
    { label: 'AI Coach', icon: IconMessageChatbot, path: '/chat' },
    { label: 'Performance PRs', icon: IconTrophy, path: '/prs' },
    { label: 'Year Analytics', icon: IconChartBar, path: '/year-stats' },
  ];

  const adminLink = { label: 'Admin Panel', icon: IconShieldLock, path: '/admin', color: 'red' };

  return (
    <AppShell
      header={{ height: 60 }}
      navbar={{
        width: 250,
        breakpoint: 'sm',
        collapsed: { mobile: !opened },
      }}
      padding="md"
    >
      <AppShell.Header bg="midnight.9" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        <Group h="100%" px="md" justify="space-between">
          <Group>
            <Burger opened={opened} onClick={toggle} hiddenFrom="sm" size="sm" />
            <Box onClick={() => navigate('/')} style={{ cursor: 'pointer' }}>
              <Text
                size="xl"
                fw={900}
                variant="gradient"
                gradient={{ from: 'blue', to: 'cyan' }}
                style={{ fontFamily: 'Outfit, sans-serif' }}
              >
                NUDGE<span style={{ color: '#fff' }}>.IQ</span>
              </Text>
            </Box>
          </Group>

          <Group>
            {athlete ? (
              <Menu shadow="md" width={200} position="bottom-end">
                <Menu.Target>
                  <UnstyledButton>
                    <Group gap="xs">
                      <Avatar src={athlete.profile} radius="xl" size="sm" />
                      <Box visibleFrom="xs" style={{ textAlign: 'left' }}>
                        <Text size="xs" fw={700}>{athlete.firstname}</Text>
                        <Text size="10px" c="dimmed" tt="uppercase">Pro Athlete</Text>
                      </Box>
                    </Group>
                  </UnstyledButton>
                </Menu.Target>

                <Menu.Dropdown>
                  <Menu.Label>Athlete Account</Menu.Label>
                  <Menu.Item leftSection={<IconUser style={{ width: rem(14), height: rem(14) }} />} onClick={() => navigate('/settings')}>
                    Profile & Discovery
                  </Menu.Item>
                  <Menu.Item leftSection={<IconSettings style={{ width: rem(14), height: rem(14) }} />} onClick={() => navigate('/settings')}>
                    Settings
                  </Menu.Item>
                  <Menu.Divider />
                  <Menu.Item
                    color="red"
                    leftSection={<IconLogout style={{ width: rem(14), height: rem(14) }} />}
                    onClick={handleLogout}
                  >
                    Logout
                  </Menu.Item>
                </Menu.Dropdown>
              </Menu>
            ) : (
              <Button size="xs" onClick={() => navigate('/')}>Login</Button>
            )}
          </Group>
        </Group>
      </AppShell.Header>

      <AppShell.Navbar p="sm" bg="midnight.9" style={{ borderRight: '1px solid rgba(255,255,255,0.05)' }}>
        <AppShell.Section grow px="xs">
          <Stack gap={4}>
            {navLinks.map((link) => (
              <NavLink
                key={link.path}
                label={link.label}
                leftSection={<link.icon size="1.2rem" stroke={1.5} />}
                onClick={() => {
                  navigate(link.path);
                  if (opened) toggle();
                }}
                active={location.pathname === link.path || (link.exact === false && location.pathname.startsWith(link.path))}
                color="blue"
                variant="filled"
                styles={{
                  root: {
                    borderRadius: rem(8),
                    marginBottom: rem(2),
                  },
                  label: {
                    fontWeight: 600,
                  }
                }}
              />
            ))}

            <Divider my="sm" label="Utility" labelPosition="center" />

            <NavLink
              label={adminLink.label}
              leftSection={<adminLink.icon size="1.2rem" stroke={1.5} />}
              onClick={() => navigate(adminLink.path)}
              active={location.pathname === adminLink.path}
              variant="subtle"
              color="red"
              styles={{
                root: { borderRadius: rem(8) }
              }}
            />
          </Stack>
        </AppShell.Section>

        <AppShell.Section p="md">
          <Box p="md" bg="electric.8" style={{ borderRadius: rem(12), position: 'relative', overflow: 'hidden' }}>
            <Box style={{ position: 'relative', zIndex: 1 }}>
              <Text size="10px" fw={900} tt="uppercase" c="white" opacity={0.8}>Intelligence Plus</Text>
              <Text size="sm" fw={800} mb="xs" c="white">Unlock Predictions</Text>
              <Button size="compact-xs" color="white" variant="white" c="blue.8" radius="xl">Upgrade Now</Button>
            </Box>
            <IconDashboard size={60} style={{ position: 'absolute', right: rem(-10), bottom: rem(-10), opacity: 0.2, color: '#fff' }} />
          </Box>
        </AppShell.Section>
      </AppShell.Navbar>

      <AppShell.Main bg="midnight.8" style={{ minHeight: '100vh' }}>
        <Container size="xl" py="md">
          {children}
        </Container>
      </AppShell.Main>
    </AppShell>
  );
}
