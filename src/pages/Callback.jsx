import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { exchangeToken, storeAuthData } from '../utils/stravaApi';
import { syncAllDataToFirebase } from '../utils/dataSyncService';
import './Callback.css';

function Callback() {
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState('processing');
  const [progress, setProgress] = useState('Connecting to Strava...');
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const handleCallback = async () => {
      const code = searchParams.get('code');
      const errorParam = searchParams.get('error');

      if (errorParam) {
        setStatus('error');
        setError('Authorization was denied');
        setTimeout(() => navigate('/'), 3000);
        return;
      }

      if (!code) {
        setStatus('error');
        setError('No authorization code received');
        setTimeout(() => navigate('/'), 3000);
        return;
      }

      try {
        setProgress('Exchanging authorization code...');
        const data = await exchangeToken(code);
        storeAuthData(data);
        
        setProgress('Authentication successful! Syncing your data...');
        
        // Sync all data from Strava to Firebase
        try {
          await syncAllDataToFirebase(data, (progressMessage) => {
            setProgress(progressMessage);
          });
          
          setStatus('success');
          setProgress('Data synchronization completed!');
          setTimeout(() => navigate('/'), 2000);
          
        } catch (syncError) {
          console.error('Data sync error:', syncError);
          
          // Even if sync fails, we still have auth, so proceed
          setStatus('partial-success');
          setProgress('Authentication successful, but data sync had issues. You can try refreshing data later.');
          setTimeout(() => navigate('/'), 3000);
        }
        
      } catch (err) {
        setStatus('error');
        setError(err.message || 'Failed to authenticate with Strava');
        setTimeout(() => navigate('/'), 3000);
      }
    };

    handleCallback();
  }, [searchParams, navigate]);

  return (
    <div className="callback">
      <div className="callback-content">
        {status === 'processing' && (
          <>
            <div className="spinner"></div>
            <h2>Setting up your account...</h2>
            <p>{progress}</p>
          </>
        )}

        {status === 'success' && (
          <>
            <div className="success-icon">✓</div>
            <h2>Successfully Connected!</h2>
            <p>{progress}</p>
            <p className="redirect-msg">Redirecting you to the dashboard...</p>
          </>
        )}

        {status === 'partial-success' && (
          <>
            <div className="warning-icon">⚠️</div>
            <h2>Connected with Partial Sync</h2>
            <p>{progress}</p>
            <p className="redirect-msg">Redirecting you to the dashboard...</p>
          </>
        )}

        {status === 'error' && (
          <>
            <div className="error-icon">✗</div>
            <h2>Authentication Failed</h2>
            <p>{error}</p>
            <p className="redirect-msg">Redirecting to home page...</p>
          </>
        )}
      </div>
    </div>
  );
}

export default Callback;
