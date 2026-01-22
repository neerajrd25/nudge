import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { MantineProvider } from '@mantine/core';
import '@mantine/core/styles.css';
import '@mantine/carousel/styles.css';
import './index.css'
import App from './App.jsx'
import { AuthProvider } from './context/AuthContext';
import { theme } from './theme';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AuthProvider>
      <MantineProvider theme={theme} defaultColorScheme="dark">
        <App />
      </MantineProvider>
    </AuthProvider>
  </StrictMode>,
)
