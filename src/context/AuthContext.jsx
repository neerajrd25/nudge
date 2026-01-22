import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { getStoredAuthData, clearAuthData, getAuthorizationUrl } from '../utils/stravaApi';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [athlete, setAthlete] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);

  const refreshAuth = useCallback(() => {
    const authData = getStoredAuthData();
    if (authData?.athlete && authData?.accessToken) {
      setAthlete(authData.athlete);
      setIsAuthenticated(true);
    } else {
      setAthlete(null);
      setIsAuthenticated(false);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    refreshAuth();

    // Listen for auth changes from other tabs/windows
    const handleStorageChange = (e) => {
      if (e.key === 'strava_access_token' || e.key === 'strava_athlete') {
        refreshAuth();
      }
    };

    // Custom event for internal app changes (like Callback.jsx)
    const handleAuthChange = () => {
      refreshAuth();
    };

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('authChanged', handleAuthChange);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('authChanged', handleAuthChange);
    };
  }, [refreshAuth]);

  const login = () => {
    window.location.href = getAuthorizationUrl();
  };

  const logout = () => {
    clearAuthData();
    setAthlete(null);
    setIsAuthenticated(false);
    window.dispatchEvent(new Event('authChanged'));
    // Redirect to home if needed, or rely on conditional rendering
    window.location.href = '/';
  };

  const value = {
    athlete,
    isAuthenticated,
    loading,
    login,
    logout,
    refreshAuth,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
