import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  getStoredAuthData,
  getAthleteActivitiesLast3Months,
  refreshAccessToken,
  storeAuthData,
  isTokenExpired,
} from '../utils/stravaApi';
import { storeActivitiesInFirebase } from '../utils/firebaseService';
import './Activities.css';

function Activities() {
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [syncStatus, setSyncStatus] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    loadActivities();
  }, []);

  const loadActivities = async () => {
    try {
      const authData = getStoredAuthData();
      
      if (!authData || !authData.accessToken) {
        navigate('/');
        return;
      }

      let accessToken = authData.accessToken;

      // Refresh token if expired
      if (isTokenExpired() && authData.refreshToken) {
        const newAuthData = await refreshAccessToken(authData.refreshToken);
        storeAuthData(newAuthData);
        accessToken = newAuthData.access_token;
      }

      // Fetch last 3 months of activities from Strava
      setSyncStatus('Fetching activities from Strava...');
      const data = await getAthleteActivitiesLast3Months(accessToken);
      setActivities(data);

      // Store activities in Firebase if athlete data is available
      if (authData.athlete && authData.athlete.id) {
        setSyncStatus(`Storing ${data.length} activities in Firebase...`);
        try {
          const result = await storeActivitiesInFirebase(
            String(authData.athlete.id),
            data
          );
          setSyncStatus(`✓ ${result.message}`);
          setTimeout(() => setSyncStatus(null), 3000);
        } catch (firebaseError) {
          console.error('Firebase storage error:', firebaseError);
          setSyncStatus('⚠️ Activities loaded but Firebase sync failed. Check Firebase configuration.');
          setTimeout(() => setSyncStatus(null), 5000);
        }
      } else {
        setSyncStatus(null);
      }
    } catch (err) {
      console.error('Error loading activities:', err);
      setError('Failed to load activities. Please try again.');
      setSyncStatus(null);
    } finally {
      setLoading(false);
    }
  };

  const formatDistance = (meters) => {
    const km = (meters / 1000).toFixed(2);
    return `${km} km`;
  };

  const formatDuration = (seconds) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getActivityIcon = (type) => {
    const icons = {
      Run: '🏃',
      Ride: '🚴',
      Swim: '🏊',
      Walk: '🚶',
      Hike: '🥾',
      Workout: '💪',
      default: '🏃',
    };
    return icons[type] || icons.default;
  };

  return (
    <div className="activities">
      <header className="activities-header">
        <button className="back-btn" onClick={() => navigate('/')}>
          ← Back
        </button>
        <h1>📊 Your Activities</h1>
      </header>

      <main className="activities-main">
        {syncStatus && (
          <div className="sync-status">
            <p>{syncStatus}</p>
          </div>
        )}

        {loading && (
          <div className="loading">
            <div className="spinner"></div>
            <p>Loading activities...</p>
          </div>
        )}

        {error && (
          <div className="error-message">
            <p>{error}</p>
            <button onClick={loadActivities}>Try Again</button>
          </div>
        )}

        {!loading && !error && activities.length === 0 && (
          <div className="no-activities">
            <p>No activities found. Start training and sync with Strava!</p>
          </div>
        )}

        {!loading && !error && activities.length > 0 && (
          <div className="activities-grid">
            {activities.map((activity) => (
              <div key={activity.id} className="activity-card">
                <div className="activity-header">
                  <span className="activity-icon">
                    {getActivityIcon(activity.type)}
                  </span>
                  <div className="activity-title-section">
                    <h3>{activity.name}</h3>
                    <p className="activity-date">{formatDate(activity.start_date)}</p>
                  </div>
                </div>

                <div className="activity-stats">
                  <div className="stat">
                    <span className="stat-label">Distance</span>
                    <span className="stat-value">{formatDistance(activity.distance)}</span>
                  </div>
                  <div className="stat">
                    <span className="stat-label">Duration</span>
                    <span className="stat-value">{formatDuration(activity.moving_time)}</span>
                  </div>
                  {activity.average_speed && (
                    <div className="stat">
                      <span className="stat-label">Avg Speed</span>
                      <span className="stat-value">
                        {(activity.average_speed * 3.6).toFixed(1)} km/h
                      </span>
                    </div>
                  )}
                </div>

                {activity.total_elevation_gain > 0 && (
                  <div className="activity-elevation">
                    <span>⛰️ Elevation: {Math.round(activity.total_elevation_gain)}m</span>
                  </div>
                )}

                {activity.achievement_count > 0 && (
                  <div className="activity-achievements">
                    <span>🏆 {activity.achievement_count} achievements</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

export default Activities;
