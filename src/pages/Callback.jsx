import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { exchangeToken, storeAuthData } from '../utils/stravaApi';
import './Callback.css';

function Callback() {
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState('processing');
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
        const data = await exchangeToken(code);
        storeAuthData(data);
        setStatus('success');
        setTimeout(() => navigate('/'), 1500);
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
            <h2>Connecting to Strava...</h2>
            <p>Please wait while we authenticate your account</p>
          </>
        )}

        {status === 'success' && (
          <>
            <div className="success-icon">✓</div>
            <h2>Successfully Connected!</h2>
            <p>Redirecting you to the dashboard...</p>
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
