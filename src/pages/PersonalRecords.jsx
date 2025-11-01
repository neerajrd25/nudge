import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  getStoredAuthData,
  getAthleteStats,
  getAthleteActivitiesLast3Months,
  refreshAccessToken,
  storeAuthData,
  isTokenExpired,
} from '../utils/stravaApi';
import './PersonalRecords.css';

function PersonalRecords() {
  const [stats, setStats] = useState(null);
  const [runningPRs, setRunningPRs] = useState({});
  const [cyclingPRs, setCyclingPRs] = useState({});
  const [loading, setLoading] = useState(true);
  const [loadingStatus, setLoadingStatus] = useState('');
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
      setLoadingStatus('Loading athlete stats...');
      const athleteStats = await getAthleteStats(accessToken, authData.athlete.id);
      setStats(athleteStats);

      // Fetch activities to get best efforts (PRs)
      setLoadingStatus('Fetching activities...');
      const activities = await getAthleteActivitiesLast3Months(accessToken);
      
      // Process running and cycling activities to find PRs
      setLoadingStatus('Computing personal records...');
      await computePersonalRecords(accessToken, activities);
      
      setLoadingStatus('');
    } catch (err) {
      console.error('Error loading personal records:', err);
      setError('Failed to load personal records. Please try again.');
      setLoadingStatus('');
    } finally {
      setLoading(false);
    }
  };

  const computePersonalRecords = async (accessToken, activities) => {
    const runPRs = {};
    const ridePRs = {};
    
    // We'll track PRs for standard distances
    // For running: fastest times
    // For cycling: highest average speeds and longest distances
    
    // Filter running and cycling activities
    const runActivities = activities.filter(a => a.type === 'Run');
    const rideActivities = activities.filter(a => a.type === 'Ride');
    
    // Process running activities
    if (runActivities.length > 0) {
      // Find fastest run
      const fastestRun = runActivities.reduce((fastest, current) => {
        const currentSpeed = current.average_speed || 0;
        const fastestSpeed = fastest.average_speed || 0;
        return currentSpeed > fastestSpeed ? current : fastest;
      });
      runPRs.fastestRun = fastestRun;
      
      // Find longest run
      const longestRun = runActivities.reduce((longest, current) => {
        return (current.distance || 0) > (longest.distance || 0) ? current : longest;
      });
      runPRs.longestRun = longestRun;
      
      // Find most elevation gain
      const mostElevationRun = runActivities.reduce((most, current) => {
        return (current.total_elevation_gain || 0) > (most.total_elevation_gain || 0) ? current : most;
      });
      runPRs.mostElevation = mostElevationRun;
    }
    
    // Process cycling activities
    if (rideActivities.length > 0) {
      // Find fastest ride (by average speed)
      const fastestRide = rideActivities.reduce((fastest, current) => {
        const currentSpeed = current.average_speed || 0;
        const fastestSpeed = fastest.average_speed || 0;
        return currentSpeed > fastestSpeed ? current : fastest;
      });
      ridePRs.fastestRide = fastestRide;
      
      // Find longest ride
      const longestRide = rideActivities.reduce((longest, current) => {
        return (current.distance || 0) > (longest.distance || 0) ? current : longest;
      });
      ridePRs.longestRide = longestRide;
      
      // Find most elevation gain
      const mostElevationRide = rideActivities.reduce((most, current) => {
        return (current.total_elevation_gain || 0) > (most.total_elevation_gain || 0) ? current : most;
      });
      ridePRs.mostElevation = mostElevationRide;
    }
    
    setRunningPRs(runPRs);
    setCyclingPRs(ridePRs);
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

    const hasPRs = runningPRs && Object.keys(runningPRs).length > 0;

    return (
      <div className="pr-section">
        <h2 className="section-title">🏃 Running Personal Records</h2>
        
        {hasPRs && (
          <>
            <h3 className="subsection-title">🏆 Your Best Performances (Last 3 Months)</h3>
            <div className="pr-cards-grid">
              {runningPRs.fastestRun && (
                <div className="pr-card">
                  <div className="pr-card-header">
                    <span className="pr-icon">⚡</span>
                    <h4>Fastest Run</h4>
                  </div>
                  <p className="pr-activity-name">{runningPRs.fastestRun.name}</p>
                  <div className="pr-stats">
                    <div className="pr-stat">
                      <span className="pr-stat-label">Avg Speed</span>
                      <span className="pr-stat-value">
                        {(runningPRs.fastestRun.average_speed * 3.6).toFixed(1)} km/h
                      </span>
                    </div>
                    <div className="pr-stat">
                      <span className="pr-stat-label">Pace</span>
                      <span className="pr-stat-value">
                        {formatPace(runningPRs.fastestRun.average_speed)}
                      </span>
                    </div>
                    <div className="pr-stat">
                      <span className="pr-stat-label">Distance</span>
                      <span className="pr-stat-value">
                        {formatDistance(runningPRs.fastestRun.distance)}
                      </span>
                    </div>
                  </div>
                  <p className="pr-date">{new Date(runningPRs.fastestRun.start_date).toLocaleDateString()}</p>
                </div>
              )}
              
              {runningPRs.longestRun && (
                <div className="pr-card">
                  <div className="pr-card-header">
                    <span className="pr-icon">📏</span>
                    <h4>Longest Run</h4>
                  </div>
                  <p className="pr-activity-name">{runningPRs.longestRun.name}</p>
                  <div className="pr-stats">
                    <div className="pr-stat">
                      <span className="pr-stat-label">Distance</span>
                      <span className="pr-stat-value">
                        {formatDistance(runningPRs.longestRun.distance)}
                      </span>
                    </div>
                    <div className="pr-stat">
                      <span className="pr-stat-label">Time</span>
                      <span className="pr-stat-value">
                        {formatTime(runningPRs.longestRun.moving_time)}
                      </span>
                    </div>
                    <div className="pr-stat">
                      <span className="pr-stat-label">Avg Pace</span>
                      <span className="pr-stat-value">
                        {formatPace(runningPRs.longestRun.average_speed)}
                      </span>
                    </div>
                  </div>
                  <p className="pr-date">{new Date(runningPRs.longestRun.start_date).toLocaleDateString()}</p>
                </div>
              )}
              
              {runningPRs.mostElevation && runningPRs.mostElevation.total_elevation_gain > 0 && (
                <div className="pr-card">
                  <div className="pr-card-header">
                    <span className="pr-icon">⛰️</span>
                    <h4>Most Elevation Gain</h4>
                  </div>
                  <p className="pr-activity-name">{runningPRs.mostElevation.name}</p>
                  <div className="pr-stats">
                    <div className="pr-stat">
                      <span className="pr-stat-label">Elevation</span>
                      <span className="pr-stat-value">
                        {Math.round(runningPRs.mostElevation.total_elevation_gain)} m
                      </span>
                    </div>
                    <div className="pr-stat">
                      <span className="pr-stat-label">Distance</span>
                      <span className="pr-stat-value">
                        {formatDistance(runningPRs.mostElevation.distance)}
                      </span>
                    </div>
                    <div className="pr-stat">
                      <span className="pr-stat-label">Time</span>
                      <span className="pr-stat-value">
                        {formatTime(runningPRs.mostElevation.moving_time)}
                      </span>
                    </div>
                  </div>
                  <p className="pr-date">{new Date(runningPRs.mostElevation.start_date).toLocaleDateString()}</p>
                </div>
              )}
            </div>
          </>
        )}

        <h3 className="subsection-title">📊 All-Time Running Stats</h3>
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

  const formatPace = (metersPerSecond) => {
    if (!metersPerSecond) return 'N/A';
    const secondsPerKm = 1000 / metersPerSecond;
    const minutes = Math.floor(secondsPerKm / 60);
    const seconds = Math.floor(secondsPerKm % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')} /km`;
  };

  const renderCyclingPRs = () => {
    if (!stats || !stats.all_ride_totals) {
      return <p className="no-data">No cycling data available</p>;
    }

    const hasPRs = cyclingPRs && Object.keys(cyclingPRs).length > 0;

    return (
      <div className="pr-section">
        <h2 className="section-title">🚴 Cycling Personal Records</h2>
        
        {hasPRs && (
          <>
            <h3 className="subsection-title">🏆 Your Best Performances (Last 3 Months)</h3>
            <div className="pr-cards-grid">
              {cyclingPRs.fastestRide && (
                <div className="pr-card">
                  <div className="pr-card-header">
                    <span className="pr-icon">⚡</span>
                    <h4>Fastest Ride</h4>
                  </div>
                  <p className="pr-activity-name">{cyclingPRs.fastestRide.name}</p>
                  <div className="pr-stats">
                    <div className="pr-stat">
                      <span className="pr-stat-label">Avg Speed</span>
                      <span className="pr-stat-value">
                        {(cyclingPRs.fastestRide.average_speed * 3.6).toFixed(1)} km/h
                      </span>
                    </div>
                    <div className="pr-stat">
                      <span className="pr-stat-label">Distance</span>
                      <span className="pr-stat-value">
                        {formatDistance(cyclingPRs.fastestRide.distance)}
                      </span>
                    </div>
                    <div className="pr-stat">
                      <span className="pr-stat-label">Time</span>
                      <span className="pr-stat-value">
                        {formatTime(cyclingPRs.fastestRide.moving_time)}
                      </span>
                    </div>
                  </div>
                  <p className="pr-date">{new Date(cyclingPRs.fastestRide.start_date).toLocaleDateString()}</p>
                </div>
              )}
              
              {cyclingPRs.longestRide && (
                <div className="pr-card">
                  <div className="pr-card-header">
                    <span className="pr-icon">📏</span>
                    <h4>Longest Ride</h4>
                  </div>
                  <p className="pr-activity-name">{cyclingPRs.longestRide.name}</p>
                  <div className="pr-stats">
                    <div className="pr-stat">
                      <span className="pr-stat-label">Distance</span>
                      <span className="pr-stat-value">
                        {formatDistance(cyclingPRs.longestRide.distance)}
                      </span>
                    </div>
                    <div className="pr-stat">
                      <span className="pr-stat-label">Time</span>
                      <span className="pr-stat-value">
                        {formatTime(cyclingPRs.longestRide.moving_time)}
                      </span>
                    </div>
                    <div className="pr-stat">
                      <span className="pr-stat-label">Avg Speed</span>
                      <span className="pr-stat-value">
                        {(cyclingPRs.longestRide.average_speed * 3.6).toFixed(1)} km/h
                      </span>
                    </div>
                  </div>
                  <p className="pr-date">{new Date(cyclingPRs.longestRide.start_date).toLocaleDateString()}</p>
                </div>
              )}
              
              {cyclingPRs.mostElevation && cyclingPRs.mostElevation.total_elevation_gain > 0 && (
                <div className="pr-card">
                  <div className="pr-card-header">
                    <span className="pr-icon">⛰️</span>
                    <h4>Most Elevation Gain</h4>
                  </div>
                  <p className="pr-activity-name">{cyclingPRs.mostElevation.name}</p>
                  <div className="pr-stats">
                    <div className="pr-stat">
                      <span className="pr-stat-label">Elevation</span>
                      <span className="pr-stat-value">
                        {Math.round(cyclingPRs.mostElevation.total_elevation_gain)} m
                      </span>
                    </div>
                    <div className="pr-stat">
                      <span className="pr-stat-label">Distance</span>
                      <span className="pr-stat-value">
                        {formatDistance(cyclingPRs.mostElevation.distance)}
                      </span>
                    </div>
                    <div className="pr-stat">
                      <span className="pr-stat-label">Time</span>
                      <span className="pr-stat-value">
                        {formatTime(cyclingPRs.mostElevation.moving_time)}
                      </span>
                    </div>
                  </div>
                  <p className="pr-date">{new Date(cyclingPRs.mostElevation.start_date).toLocaleDateString()}</p>
                </div>
              )}
            </div>
          </>
        )}

        <h3 className="subsection-title">📊 All-Time Cycling Stats</h3>
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
            <p>{loadingStatus || 'Loading personal records...'}</p>
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
