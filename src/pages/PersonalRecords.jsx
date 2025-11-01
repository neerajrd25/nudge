import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getStoredAuthData } from '../utils/stravaApi';
import { getRunningPRs, getCyclingPRs } from '../utils/firebaseService';
import './PersonalRecords.css';

function secondsToTime(s) {
  if (s === null || s === undefined) return '—';
  const sec = Math.round(s);
  const hrs = Math.floor(sec / 3600);
  const mins = Math.floor((sec % 3600) / 60);
  const secs = sec % 60;
  if (hrs > 0) return `${hrs}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

function PersonalRecords() {
  const [activeTab, setActiveTab] = useState('Run');
  const [prData, setPrData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const load = async () => {
      try {
        const authData = getStoredAuthData();
        if (!authData || !authData.athlete || !authData.athlete.id) {
          navigate('/');
          return;
        }

        const athleteId = String(authData.athlete.id);
        setLoading(true);
        if (activeTab === 'Run') {
          const pr = await getRunningPRs(athleteId);
          setPrData(pr);
        } else if (activeTab === 'Cycling') {
          const pr = await getCyclingPRs(athleteId);
          setPrData(pr);
        } else {
          setPrData({});
        }
      } catch (err) {
        console.error('Failed to load PRs:', err);
        setError('Failed to load personal records.');
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [activeTab, navigate]);

  return (
    <div className="pr-page">
      <header className="pr-header">
        <button className="back-btn" onClick={() => navigate(-1)}>← Back</button>
        <h1>🏆 Personal Records</h1>
      </header>

      <main className="pr-main">
        <div className="tabs">
          <button className={`tab ${activeTab === 'Run' ? 'active' : ''}`} onClick={() => setActiveTab('Run')}>Running</button>
          <button className={`tab ${activeTab === 'Cycling' ? 'active' : ''}`} onClick={() => setActiveTab('Cycling')}>Cycling</button>
        </div>

        {loading && <div className="loading">Loading personal records...</div>}
        {error && <div className="error">{error}</div>}

        {!loading && prData && activeTab === 'Run' && (
          <div className="pr-list">
            {['400m','1km','1 mile','5k','10k','15k','Half Marathon','Marathon','Longest'].map((label) => {
              const item = prData[label];
              if (!item) return (
                <div key={label} className="pr-row">
                  <div className="pr-label">{label}</div>
                  <div className="pr-value">—</div>
                </div>
              );

              if (label === 'Longest') {
                return (
                  <div key={label} className="pr-row">
                    <div className="pr-label">Longest</div>
                    <div className="pr-value">{item.distance ? `${(item.distance/1000).toFixed(2)} km` : '—'}</div>
                  </div>
                );
              }

              return (
                <div key={label} className="pr-row">
                  <div className="pr-label">{label}</div>
                  <div className="pr-value">{item.timeSeconds ? secondsToTime(item.timeSeconds) : '—'}</div>
                  <div className="pr-meta">{item.activity ? `${item.activity.name} • ${new Date(item.activity.start_date).toLocaleDateString()} (${item.method})` : ''}</div>
                </div>
              );
            })}
          </div>
        )}

        {!loading && prData && activeTab === 'Cycling' && (
          <div className="pr-list">
            {[
              'Longest Ride',
              'Biggest Climb',
              'Elevation Gain',
              '5 mile','10K','10 mile','20K','30K','40K','50K','80K','50 mile','90K','100K','100 mile','180K'
            ].map((label) => {
              const item = prData[label];
              if (!item) return (
                <div key={label} className="pr-row">
                  <div className="pr-label">{label}</div>
                  <div className="pr-value">—</div>
                </div>
              );

              if (label === 'Longest Ride') {
                return (
                  <div key={label} className="pr-row">
                    <div className="pr-label">{label}</div>
                    <div className="pr-value">{item.distance ? `${(item.distance/1000).toFixed(2)} km` : '—'}</div>
                    {item.activity && (
                      <a className="pr-link" href={`https://www.strava.com/activities/${item.activity.id}`} target="_blank" rel="noopener noreferrer">🔗</a>
                    )}
                  </div>
                );
              }

              if (label === 'Biggest Climb') {
                return (
                  <div key={label} className="pr-row">
                    <div className="pr-label">{label}</div>
                    <div className="pr-value">{item.elevation ? `${Math.round(item.elevation)} m` : '—'}</div>
                    {item.activity && (
                      <a className="pr-link" href={`https://www.strava.com/activities/${item.activity.id}`} target="_blank" rel="noopener noreferrer">🔗</a>
                    )}
                  </div>
                );
              }

              if (label === 'Elevation Gain') {
                return (
                  <div key={label} className="pr-row">
                    <div className="pr-label">{label}</div>
                    <div className="pr-value">{item.total ? `${Math.round(item.total)} m` : '—'}</div>
                  </div>
                );
              }

              // distance/time rows
              return (
                <div key={label} className="pr-row">
                  <div className="pr-label">{label}</div>
                  <div className="pr-value">{item.timeSeconds ? secondsToTime(item.timeSeconds) : '—'}</div>
                  <div className="pr-meta">{item.activity ? `${item.activity.name} • ${new Date(item.activity.start_date).toLocaleDateString()} (${item.method})` : ''}</div>
                  {item.activity && (
                    <a className="pr-link" href={`https://www.strava.com/activities/${item.activity.id}`} target="_blank" rel="noopener noreferrer">🔗</a>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}

export default PersonalRecords;
