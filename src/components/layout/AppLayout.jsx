import { useState, useEffect } from "react";
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
  Container,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { useNavigate, useLocation } from "react-router-dom";
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
  IconSmartHome,
  IconChartLine,
  IconMap2,
} from "@tabler/icons-react";
import { useAuth } from "../../context/AuthContext";

export function AppLayout({ children }) {
  const [opened, { toggle }] = useDisclosure();
  const navigate = useNavigate();
  const location = useLocation();
  const { athlete, logout, login } = useAuth();

  const handleLogout = () => {
    logout();
  };

  const navLinks = [
    { label: "Intelligence", icon: IconSmartHome, path: "/", exact: true },
    { label: "Footprint", icon: IconMap2, path: "/footprint" },
    { label: "Activities", icon: IconActivity, path: "/activities" },
    { label: "Training Plan", icon: IconCalendar, path: "/planner" },
    { label: "AI Coach", icon: IconMessageChatbot, path: "/chat" },
    { label: "Fitness Charts", icon: IconChartLine, path: "/charts" },
    { label: "Performance PRs", icon: IconTrophy, path: "/prs" },
    { label: "Year Analytics", icon: IconChartBar, path: "/year-stats" },
  ];

  const adminLink = {
    label: "Admin Panel",
    icon: IconShieldLock,
    path: "/admin",
    color: "red",
  };

  return (
    <AppShell
      header={{ height: 60 }}
      navbar={{
        width: 250,
        breakpoint: "sm",
        collapsed: { mobile: !opened, desktop: false },
      }}
      padding="md"
    >
      <AppShell.Header
        bg="midnight.9"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}
      >
        <Group h="100%" px="md" justify="space-between">
          <Group>
            <Burger
              opened={opened}
              onClick={toggle}
              hiddenFrom="sm"
              size="sm"
            />
            <Box
              onClick={() => navigate("/")}
              style={{
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: rem(8),
              }}
            >
              <img
                src={"/momentum_iq.png"}
                alt="Momentum.IQ logo"
                style={{ height: rem(36), borderRadius: rem(8) }}
              />

              <Text
                size="xl"
                fw={900}
                variant="gradient"
                gradient={{ from: "blue", to: "cyan" }}
                style={{ fontFamily: "Outfit, sans-serif" }}
              >
                Momentum<span style={{ color: "#fff" }}>.IQ</span>
              </Text>
            </Box>
          </Group>

          <Group>
            <Menu shadow="md" width={200} position="bottom-end">
              <Menu.Target>
                <UnstyledButton>
                  <Group gap="xs">
                    <Avatar src={athlete?.profile} radius="xl" size="sm" />
                    <Box visibleFrom="xs" style={{ textAlign: "left" }}>
                      <Text size="xs" fw={700}>
                        {athlete?.firstname}
                      </Text>
                      <Text size="10px" c="dimmed" tt="uppercase">
                        Pro Athlete
                      </Text>
                    </Box>
                  </Group>
                </UnstyledButton>
              </Menu.Target>

              <Menu.Dropdown>
                <Menu.Label>Athlete Account</Menu.Label>
                <Menu.Item
                  leftSection={
                    <IconUser style={{ width: rem(14), height: rem(14) }} />
                  }
                  onClick={() => navigate("/settings")}
                >
                  Profile & Discovery
                </Menu.Item>
                <Menu.Item
                  leftSection={
                    <IconSettings
                      style={{ width: rem(14), height: rem(14) }}
                    />
                  }
                  onClick={() => navigate("/settings")}
                >
                  Settings
                </Menu.Item>
                <Menu.Divider />
                <Menu.Item
                  color="red"
                  leftSection={
                    <IconLogout style={{ width: rem(14), height: rem(14) }} />
                  }
                  onClick={handleLogout}
                >
                  Logout
                </Menu.Item>
              </Menu.Dropdown>
            </Menu>
          </Group>
        </Group>
      </AppShell.Header>

      <AppShell.Navbar
        p="sm"
        bg="midnight.9"
        style={{ borderRight: "1px solid rgba(255,255,255,0.05)" }}
      >
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
                active={
                  location.pathname === link.path ||
                  (link.exact === false &&
                    location.pathname.startsWith(link.path))
                }
                color="blue"
                variant="filled"
                styles={{
                  root: {
                    borderRadius: rem(8),
                    marginBottom: rem(2),
                  },
                  label: {
                    fontWeight: 600,
                  },
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
                root: { borderRadius: rem(8) },
              }}
            />
          </Stack>
        </AppShell.Section>

        <AppShell.Section p="md">
          <Box
            p="md"
            bg="electric.8"
            style={{
              borderRadius: rem(12),
              position: "relative",
              overflow: "hidden",
            }}
          >
            <Box style={{ position: "relative", zIndex: 1 }}>
              <Text size="10px" fw={900} tt="uppercase" c="white" opacity={0.8}>
                Intelligence Plus
              </Text>
              <Text size="sm" fw={800} mb="xs" c="white">
                Unlock Predictions
              </Text>
              <Button
                size="compact-xs"
                color="white"
                variant="white"
                c="blue.8"
                radius="xl"
              >
                Upgrade Now
              </Button>
            </Box>
            <IconDashboard
              size={60}
              style={{
                position: "absolute",
                right: rem(-10),
                bottom: rem(-10),
                opacity: 0.2,
                color: "#fff",
              }}
            />
          </Box>
        </AppShell.Section>
      </AppShell.Navbar>

      <AppShell.Main
        bg="midnight.8"
        style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}
      >
        <Container size="xl" py="md" style={{ flex: 1, width: "100%" }}>
          {children}
        </Container>

        <Box
          component="footer"
          p="xl"
          bg="midnight.9"
          style={{
            borderTop: "1px solid rgba(255,255,255,0.05)",
            textAlign: "center",
          }}
        >
          <Stack gap="xs" align="center">
            <Group gap="xs" justify="center">
              <Text size="xs" c="dimmed" fw={500}>
                © {new Date().getFullYear()} Momentum.IQ
              </Text>
              <Box w={4} h={4} bg="dimmed" style={{ borderRadius: "50%" }} />
              <Text size="xs" c="dimmed" fw={500}>
                Professional Athlete Intelligence
              </Text>
            </Group>
            <Group gap="sm" justify="center">
              <img
                src="/1.2-Strava-API-Logos/Powered by Strava/pwrdBy_strava_white/api_logo_pwrdBy_strava_horiz_white.svg"
                alt="Powered by Strava"
                style={{ height: rem(24), opacity: 0.7 }}
              />
            </Group>
          </Stack>
        </Box>
      </AppShell.Main>
    </AppShell>
  );
}
