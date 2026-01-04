import { createTheme, rem } from '@mantine/core';

export const theme = createTheme({
  primaryColor: 'blue',
  primaryShade: 6,
  colors: {
    // Custom Midnight & Electric Blue palette
    midnight: [
      '#E9ECEF',
      '#DEE2E6',
      '#CED4DA',
      '#ADB5BD',
      '#6C757D',
      '#495057',
      '#343A40',
      '#212529',
      '#1A1D21',
      '#0B0E11',
    ],
    electric: [
      '#E3F2FD',
      '#BBDEFB',
      '#90CAF9',
      '#64B5F6',
      '#42A5F5',
      '#2196F3',
      '#1E88E5',
      '#1976D2',
      '#1565C0',
      '#0D47A1',
    ],
  },
  fontFamily: 'Inter, sans-serif',
  headings: {
    fontFamily: 'Outfit, sans-serif',
    fontWeight: '800',
  },
  components: {
    Button: {
      defaultProps: {
        radius: 'md',
        size: 'sm',
      },
      styles: {
        root: { fontWeight: 600, transition: 'transform 0.1s ease' },
      },
    },
    Card: {
      defaultProps: {
        radius: 'lg',
        withBorder: true,
      },
      styles: {
        root: {
          backgroundColor: 'rgba(26, 29, 33, 0.8)',
          backdropFilter: 'blur(10px)',
          borderColor: 'rgba(255, 255, 255, 0.05)',
        },
      },
    },
    Paper: {
      defaultProps: {
        radius: 'md',
      },
      styles: {
        root: {
          backgroundColor: 'var(--mantine-color-dark-7)',
        },
      },
    },
  },
  other: {
    glassBorder: '1px solid rgba(255, 255, 255, 0.1)',
    electricGradient: 'linear-gradient(135deg, #2196F3 0%, #0D47A1 100%)',
  },
});
