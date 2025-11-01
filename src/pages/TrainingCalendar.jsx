import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';
import { getStoredAuthData } from '../utils/stravaApi';
import { getActivitiesFromFirebase } from '../utils/firebaseService';
import './TrainingCalendar.css';

function TrainingCalendar() {
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [activitiesByDate, setActivitiesByDate] = useState({});
  const navigate = useNavigate();

  useEffect(() => {
    loadActivities();
  }, []);

  useEffect(() => {
    // Group activities by date
    const grouped = {};
    activities.forEach((activity) => {
      const date = new Date(activity.start_date).toDateString();
      if (!grouped[date]) {
        grouped[date] = [];
      }
      grouped[date].push(activity);
    });
    setActivitiesByDate(grouped);
  }, [activities]);

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
      const data = await getActivitiesFromFirebase(String(athleteId), 200); // Get more for calendar view
      setActivities(data);
    } catch (err) {
      console.error('Error loading activities:', err);
      setError('Failed to load activities. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const tileContent = ({ date, view }) => {
    if (view === 'month') {
      const dateString = date.toDateString();
      const dayActivities = activitiesByDate[dateString];
      
      if (dayActivities && dayActivities.length > 0) {
        return (
          <div className="calendar-tile-content">
            <div className="activity-indicator">
              {dayActivities.length} {dayActivities.length === 1 ? 'activity' : 'activities'}
            </div>
          </div>
        );
      }
    }
    return null;
  };

  const tileClassName = ({ date, view }) => {
    if (view === 'month') {
      const dateString = date.toDateString();
      if (activitiesByDate[dateString]) {
        return 'has-activities';
      }
    }
    return null;
  };

  const getSelectedDateActivities = () => {
    const dateString = selectedDate.toDateString();
    return activitiesByDate[dateString] || [];
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

  const selectedActivities = getSelectedDateActivities();

  return (
    <div className="training-calendar">
      <header className="calendar-header">
        <button className="back-btn" onClick={() => navigate('/')}>
          ← Back
        </button>
        <h1>📅 Training Calendar</h1>
      </header>

      <main className="calendar-main">
        {loading && (
          <div className="loading">
            <div className="spinner"></div>
            <p>Loading calendar...</p>
          </div>
        )}

        {error && (
          <div className="error-message">
            <p>{error}</p>
            <button onClick={loadActivities}>Try Again</button>
          </div>
        )}

        {!loading && !error && (
          <div className="calendar-container">
            <div className="calendar-section">
              <Calendar
                onChange={setSelectedDate}
                value={selectedDate}
                tileContent={tileContent}
                tileClassName={tileClassName}
                className="custom-calendar"
              />
              <div className="calendar-legend">
                <div className="legend-item">
                  <span className="legend-dot has-activity"></span>
                  <span>Days with activities</span>
                </div>
              </div>
            </div>

            <div className="selected-date-section">
              <h2>
                {selectedDate.toLocaleDateString('en-US', {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </h2>

              {selectedActivities.length === 0 ? (
                <div className="no-activities-selected">
                  <p>No activities on this day</p>
                  <p className="suggestion">
                    Select a day with activities (highlighted) to see details
                  </p>
                </div>
              ) : (
                <div className="activities-list">
                  {selectedActivities.map((activity) => (
                    <div key={activity.id} className="activity-item">
                      <div className="activity-item-header">
                        <span className="activity-icon">
                          {getActivityIcon(activity.type)}
                        </span>
                        <h3>{activity.name}</h3>
                      </div>
                      <div className="activity-item-stats">
                        <span>📏 {formatDistance(activity.distance)}</span>
                        <span>⏱️ {formatDuration(activity.moving_time)}</span>
                        {activity.total_elevation_gain > 0 && (
                          <span>⛰️ {Math.round(activity.total_elevation_gain)}m</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {selectedActivities.length > 0 && (
                <div className="day-summary">
                  <h3>Daily Summary</h3>
                  <div className="summary-stats">
                    <div className="summary-stat">
                      <span className="stat-label">Total Distance</span>
                      <span className="stat-value">
                        {formatDistance(
                          selectedActivities.reduce((sum, a) => sum + a.distance, 0)
                        )}
                      </span>
                    </div>
                    <div className="summary-stat">
                      <span className="stat-label">Total Time</span>
                      <span className="stat-value">
                        {formatDuration(
                          selectedActivities.reduce((sum, a) => sum + a.moving_time, 0)
                        )}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default TrainingCalendar;
