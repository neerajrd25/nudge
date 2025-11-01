import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getStoredAuthData, clearAuthData, getAuthorizationUrl } from '../utils/stravaApi';
import { syncAllDataToFirebase } from '../utils/dataSyncService';
import './Home.css';

function Home() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [athlete, setAthlete] = useState(null);
  const [syncing, setSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const authData = getStoredAuthData();
    if (authData && authData.accessToken) {
      setIsAuthenticated(true);
      setAthlete(authData.athlete);
    }
  }, []);

  const handleLogin = () => {
    window.location.href = getAuthorizationUrl();
  };

  const handleLogout = () => {
    clearAuthData();
    setIsAuthenticated(false);
    setAthlete(null);
  };

  return (
    <div className="home">
      <header className="home-header">
        <h1>🏃 Nudge - Training Planner</h1>
        <p className="tagline">AI-powered training planning with Strava integration</p>
      </header>

      <main className="home-main">
        {!isAuthenticated ? (
          <div className="welcome-section">
            <h2>Welcome to Nudge</h2>
            <p>
              Connect your Strava account to access your training data and get
              AI-powered insights to optimize your training plan.
            </p>
            <div className="features">
              <div className="feature">
                <span className="feature-icon">📊</span>
                <h3>Activity Tracking</h3>
                <p>View all your Strava activities in one place</p>
              </div>
              <div className="feature">
                <span className="feature-icon">📅</span>
                <h3>Training Calendar</h3>
                <p>Visualize your training schedule on a calendar</p>
              </div>
              <div className="feature">
                <span className="feature-icon">💬</span>
                <h3>AI Chat</h3>
                <p>Chat with AI about your training activities</p>
              </div>
            </div>
            <button className="strava-login-btn" onClick={handleLogin}>
              Connect with Strava
            </button>
          </div>
        ) : (
          <div className="dashboard-section">
            <div className="athlete-info">
              {athlete && (
                <>
                  <img
                    src={athlete.profile || '/vite.svg'}
                    alt={`${athlete.firstname} ${athlete.lastname}`}
                    className="athlete-avatar"
                  />
                  <h2>Welcome back, {athlete.firstname}!</h2>
                </>
              )}
              <button className="logout-btn" onClick={handleLogout}>
                Logout
              </button>
              <div style={{ marginTop: '0.5rem' }}>
                <button
                  className="sync-all-btn"
                  onClick={async () => {
                    if (syncing) return;
                    // Ask user for start date
                    const input = window.prompt('Enter start date (YYYY-MM-DD) from which to pull activities (this will be Day 1). Leave empty to use last 3 months:');
                    let startDate = null;
                    if (input && input.trim() !== '') {
                      const parsed = new Date(input.trim());
                      if (isNaN(parsed.getTime())) {
                        window.alert('Invalid date format. Please use YYYY-MM-DD');
                        return;
                      }
                      startDate = parsed.toISOString();
                    }

                    try {
                      setSyncing(true);
                      setSyncProgress('Starting full sync...');
                      const authData = getStoredAuthData();
                      if (!authData) {
                        window.alert('No authentication data found. Please log in first.');
                        setSyncing(false);
                        setSyncProgress(null);
                        return;
                      }

                      const result = await syncAllDataToFirebase(authData, (msg) => setSyncProgress(msg), startDate);
                      console.log('Full sync result:', result);
                      window.alert(result.success ? 'Sync completed successfully' : 'Sync completed with errors; check console');
                    } catch (err) {
                      console.error('Sync failed:', err);
                      window.alert('Sync failed. Check console for details.');
                    } finally {
                      setSyncing(false);
                      setSyncProgress(null);
                    }
                  }}
                  disabled={syncing}
                >
                  {syncing ? 'Syncing...' : 'Sync All'}
                </button>
                {syncProgress && <div style={{ color: '#fff', marginTop: '6px' }}>{syncProgress}</div>}
              </div>
            </div>

            <div className="navigation-cards">
              <div className="nav-card" onClick={() => navigate('/activities')}>
                <span className="nav-icon">📊</span>
                <h3>Activities</h3>
                <p>View your recent training activities</p>
              </div>
              <div className="nav-card" onClick={() => navigate('/calendar')}>
                <span className="nav-icon">📅</span>
                <h3>Training Calendar</h3>
                <p>Plan and track your training schedule</p>
              </div>
              <div className="nav-card" onClick={() => navigate('/chat')}>
                <span className="nav-icon">💬</span>
                <h3>AI Training Chat</h3>
                <p>Chat with AI about your training</p>
              </div>
              <div className="nav-card" onClick={() => navigate('/pr')}>
                <span className="nav-icon">🏆</span>
                <h3>Personal Records</h3>
                <p>View sport-wise PRs computed from your activities</p>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default Home;
