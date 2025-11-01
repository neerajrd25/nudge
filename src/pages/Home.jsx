import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getStoredAuthData, clearAuthData, getAuthorizationUrl } from '../utils/stravaApi';
import './Home.css';

function Home() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [athlete, setAthlete] = useState(null);
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
                <span className="feature-icon">🏆</span>
                <h3>Personal Records</h3>
                <p>Track your running and cycling PRs from Strava</p>
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
            </div>

            <div className="navigation-cards">
              <div className="nav-card" onClick={() => navigate('/activities')}>
                <span className="nav-icon">📊</span>
                <h3>Activities</h3>
                <p>View your recent training activities</p>
              </div>
              <div className="nav-card" onClick={() => navigate('/prs')}>
                <span className="nav-icon">🏆</span>
                <h3>Personal Records</h3>
                <p>View your running and cycling PRs</p>
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
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default Home;
