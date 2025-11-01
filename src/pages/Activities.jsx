import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getStoredAuthData } from '../utils/stravaApi';
import { getActivitiesFromFirebase, getSyncStatus } from '../utils/firebaseService';
import { autoSync } from '../utils/dataSyncService';
import './Activities.css';

function Activities() {
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [syncStatus, setSyncStatus] = useState(null);
  const [lastSyncTime, setLastSyncTime] = useState(null);
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

      const athleteId = authData.athlete?.id;
      if (!athleteId) {
        setError('No athlete data found. Please log in again.');
        return;
      }

      // Load activities from Firebase
      setSyncStatus('Loading activities from Firebase...');
      const firebaseActivities = await getActivitiesFromFirebase(String(athleteId));
      setActivities(firebaseActivities);

      // Get sync status to show last sync time
      try {
        const syncStatusData = await getSyncStatus(String(athleteId));
        if (syncStatusData) {
          setLastSyncTime(syncStatusData.lastSyncTime);
        }
      } catch (syncError) {
        console.warn('Could not fetch sync status:', syncError);
      }

      // Check if we need to auto-sync (background sync if data is old)
      try {
        setSyncStatus('Checking for data updates...');
        const syncResult = await autoSync(authData, 24, (progressMessage) => {
          setSyncStatus(progressMessage);
        });

        if (syncResult) {
          // Data was synced, reload activities
          setSyncStatus('Refreshing activities...');
          const updatedActivities = await getActivitiesFromFirebase(String(athleteId));
          setActivities(updatedActivities);
          setLastSyncTime(syncResult.lastSyncTime);
          setSyncStatus('✓ Data updated successfully');
        } else {
          setSyncStatus('✓ Activities are up to date');
        }
      } catch (syncError) {
        console.warn('Auto-sync failed, but using cached data:', syncError);
        setSyncStatus(firebaseActivities.length > 0 ? '✓ Loaded cached activities' : '⚠️ Using cached data (sync failed)');
      }

      setTimeout(() => setSyncStatus(null), 3000);

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

  const refreshData = async () => {
    setLoading(true);
    setSyncStatus('Refreshing data from Strava...');
    
    try {
      const authData = getStoredAuthData();
      if (!authData || !authData.accessToken) {
        navigate('/');
        return;
      }

      const syncResult = await autoSync(authData, 0, (progressMessage) => {
        setSyncStatus(progressMessage);
      });

      if (syncResult) {
        const athleteId = authData.athlete?.id;
        const updatedActivities = await getActivitiesFromFirebase(String(athleteId));
        setActivities(updatedActivities);
        setLastSyncTime(syncResult.lastSyncTime);
        setSyncStatus('✓ Data refreshed successfully');
      }

      setTimeout(() => setSyncStatus(null), 3000);
    } catch (error) {
      console.error('Refresh failed:', error);
      setSyncStatus('⚠️ Refresh failed. Using cached data.');
      setTimeout(() => setSyncStatus(null), 3000);
    } finally {
      setLoading(false);
    }
  };

  const formatLastSyncTime = (timeString) => {
    if (!timeString) return 'Never';
    
    const syncTime = new Date(timeString);
    const now = new Date();
    const diffMs = now - syncTime;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} min ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
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
        <div className="header-content">
          <h1>📊 Your Activities</h1>
          {lastSyncTime && (
            <p className="sync-info">Last synced: {formatLastSyncTime(lastSyncTime)}</p>
          )}
        </div>
        <button 
          className="refresh-btn" 
          onClick={refreshData}
          disabled={loading}
          title="Refresh data from Strava"
        >
          🔄
        </button>
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
