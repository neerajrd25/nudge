import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  getStoredAuthData,
  getAthleteStats,
  refreshAccessToken,
  storeAuthData,
  isTokenExpired,
} from '../utils/stravaApi';
import './PersonalRecords.css';

function PersonalRecords() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    loadPersonalRecords();
  }, []);

  const loadPersonalRecords = async () => {
    try {
      const authData = getStoredAuthData();
      
      if (!authData || !authData.accessToken) {
        navigate('/');
        return;
      }

      if (!authData.athlete || !authData.athlete.id) {
        setError('Athlete information not available. Please re-authenticate.');
        setLoading(false);
        return;
      }

      let accessToken = authData.accessToken;

      // Refresh token if expired
      if (isTokenExpired() && authData.refreshToken) {
        const newAuthData = await refreshAccessToken(authData.refreshToken);
        storeAuthData(newAuthData);
        accessToken = newAuthData.access_token;
      }

      // Fetch athlete stats from Strava
      const athleteStats = await getAthleteStats(accessToken, authData.athlete.id);
      setStats(athleteStats);
    } catch (err) {
      console.error('Error loading personal records:', err);
      setError('Failed to load personal records. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (seconds) => {
    if (!seconds) return 'N/A';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  const formatDistance = (meters) => {
    if (!meters) return 'N/A';
    const km = (meters / 1000).toFixed(2);
    return `${km} km`;
  };



  const renderRunningPRs = () => {
    if (!stats || !stats.all_run_totals) {
      return <p className="no-data">No running data available</p>;
    }

    // The Strava API doesn't directly provide PRs in the stats endpoint
    // However, we can display the totals and best efforts from recent activities
    return (
      <div className="pr-section">
        <h2 className="section-title">🏃 Running Personal Records</h2>
        <div className="pr-info-box">
          <p>⚠️ Note: Strava API does not directly expose personal records (PRs) through the stats endpoint.</p>
          <p>PRs/Best Efforts are available within individual activity details but require fetching each activity.</p>
          <p>Below are your running totals:</p>
        </div>
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-icon">📊</div>
            <div className="stat-content">
              <h3>Total Distance</h3>
              <p className="stat-value">{formatDistance(stats.all_run_totals.distance)}</p>
              <p className="stat-label">All Time</p>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon">⏱️</div>
            <div className="stat-content">
              <h3>Total Time</h3>
              <p className="stat-value">{formatTime(stats.all_run_totals.moving_time)}</p>
              <p className="stat-label">Moving Time</p>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon">🎯</div>
            <div className="stat-content">
              <h3>Total Runs</h3>
              <p className="stat-value">{stats.all_run_totals.count}</p>
              <p className="stat-label">Activities</p>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon">⛰️</div>
            <div className="stat-content">
              <h3>Total Elevation</h3>
              <p className="stat-value">{Math.round(stats.all_run_totals.elevation_gain)} m</p>
              <p className="stat-label">Elevation Gain</p>
            </div>
          </div>
        </div>

        {stats.recent_run_totals && (
          <>
            <h3 className="subsection-title">Recent (Last 4 Weeks)</h3>
            <div className="stats-grid">
              <div className="stat-card highlight">
                <div className="stat-icon">📊</div>
                <div className="stat-content">
                  <h3>Distance</h3>
                  <p className="stat-value">{formatDistance(stats.recent_run_totals.distance)}</p>
                </div>
              </div>
              <div className="stat-card highlight">
                <div className="stat-icon">⏱️</div>
                <div className="stat-content">
                  <h3>Time</h3>
                  <p className="stat-value">{formatTime(stats.recent_run_totals.moving_time)}</p>
                </div>
              </div>
              <div className="stat-card highlight">
                <div className="stat-icon">🎯</div>
                <div className="stat-content">
                  <h3>Runs</h3>
                  <p className="stat-value">{stats.recent_run_totals.count}</p>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    );
  };

  const renderCyclingPRs = () => {
    if (!stats || !stats.all_ride_totals) {
      return <p className="no-data">No cycling data available</p>;
    }

    return (
      <div className="pr-section">
        <h2 className="section-title">🚴 Cycling Personal Records</h2>
        <div className="pr-info-box">
          <p>⚠️ Note: Strava API does not directly expose personal records (PRs) through the stats endpoint.</p>
          <p>PRs/Best Efforts are available within individual activity details but require fetching each activity.</p>
          <p>Below are your cycling totals:</p>
        </div>
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-icon">📊</div>
            <div className="stat-content">
              <h3>Total Distance</h3>
              <p className="stat-value">{formatDistance(stats.all_ride_totals.distance)}</p>
              <p className="stat-label">All Time</p>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon">⏱️</div>
            <div className="stat-content">
              <h3>Total Time</h3>
              <p className="stat-value">{formatTime(stats.all_ride_totals.moving_time)}</p>
              <p className="stat-label">Moving Time</p>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon">🎯</div>
            <div className="stat-content">
              <h3>Total Rides</h3>
              <p className="stat-value">{stats.all_ride_totals.count}</p>
              <p className="stat-label">Activities</p>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon">⛰️</div>
            <div className="stat-content">
              <h3>Total Elevation</h3>
              <p className="stat-value">{Math.round(stats.all_ride_totals.elevation_gain)} m</p>
              <p className="stat-label">Elevation Gain</p>
            </div>
          </div>
        </div>

        {stats.recent_ride_totals && (
          <>
            <h3 className="subsection-title">Recent (Last 4 Weeks)</h3>
            <div className="stats-grid">
              <div className="stat-card highlight">
                <div className="stat-icon">📊</div>
                <div className="stat-content">
                  <h3>Distance</h3>
                  <p className="stat-value">{formatDistance(stats.recent_ride_totals.distance)}</p>
                </div>
              </div>
              <div className="stat-card highlight">
                <div className="stat-icon">⏱️</div>
                <div className="stat-content">
                  <h3>Time</h3>
                  <p className="stat-value">{formatTime(stats.recent_ride_totals.moving_time)}</p>
                </div>
              </div>
              <div className="stat-card highlight">
                <div className="stat-icon">🎯</div>
                <div className="stat-content">
                  <h3>Rides</h3>
                  <p className="stat-value">{stats.recent_ride_totals.count}</p>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    );
  };

  return (
    <div className="personal-records">
      <header className="pr-header">
        <button className="back-btn" onClick={() => navigate('/')}>
          ← Back
        </button>
        <h1>🏆 Personal Records</h1>
        <p className="subtitle">Your running and cycling stats from Strava</p>
      </header>

      <main className="pr-main">
        {loading && (
          <div className="loading">
            <div className="spinner"></div>
            <p>Loading personal records...</p>
          </div>
        )}

        {error && (
          <div className="error-message">
            <p>{error}</p>
            <button onClick={loadPersonalRecords}>Try Again</button>
          </div>
        )}

        {!loading && !error && stats && (
          <>
            {renderRunningPRs()}
            {renderCyclingPRs()}
          </>
        )}

        {!loading && !error && !stats && (
          <div className="no-data-container">
            <p>No personal record data available.</p>
          </div>
        )}
      </main>
    </div>
  );
}

export default PersonalRecords;
