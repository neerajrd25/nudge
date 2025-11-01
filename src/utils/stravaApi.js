import axios from 'axios';

const STRAVA_API_BASE = 'https://www.strava.com/api/v3';
const STRAVA_AUTH_BASE = 'https://www.strava.com/oauth';

// Get configuration from environment variables
const getConfig = () => ({
  clientId: import.meta.env.VITE_STRAVA_CLIENT_ID,
  clientSecret: import.meta.env.VITE_STRAVA_CLIENT_SECRET,
  redirectUri: import.meta.env.VITE_STRAVA_REDIRECT_URI || 'http://localhost:5173/callback',
});

// Generate Strava authorization URL
export const getAuthorizationUrl = () => {
  const config = getConfig();
  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    response_type: 'code',
    scope: 'read,activity:read_all',
  });
  return `${STRAVA_AUTH_BASE}/authorize?${params.toString()}`;
};

// Exchange authorization code for access token
export const exchangeToken = async (code) => {
  const config = getConfig();
  try {
    const response = await axios.post(`${STRAVA_AUTH_BASE}/token`, {
      client_id: config.clientId,
      client_secret: config.clientSecret,
      code,
      grant_type: 'authorization_code',
    });
    return response.data;
  } catch (error) {
    console.error('Error exchanging token:', error);
    throw error;
  }
};

// Refresh access token
export const refreshAccessToken = async (refreshToken) => {
  const config = getConfig();
  try {
    const response = await axios.post(`${STRAVA_AUTH_BASE}/token`, {
      client_id: config.clientId,
      client_secret: config.clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    });
    return response.data;
  } catch (error) {
    console.error('Error refreshing token:', error);
    throw error;
  }
};

// Get athlete activities
export const getAthleteActivities = async (accessToken, page = 1, perPage = 30) => {
  try {
    const response = await axios.get(`${STRAVA_API_BASE}/athlete/activities`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      params: {
        page,
        per_page: perPage,
      },
    });
    return response.data;
  } catch (error) {
    console.error('Error fetching activities:', error);
    throw error;
  }
};

// Get athlete activities for the last 3 months
export const getAthleteActivitiesLast3Months = async (accessToken) => {
  // Convenience wrapper that delegates to getAthleteActivitiesSince
  try {
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
    const afterTimestamp = Math.floor(threeMonthsAgo.getTime() / 1000);
    return await getAthleteActivitiesSince(accessToken, afterTimestamp);
  } catch (error) {
    console.error('Error fetching last 3 months activities:', error);
    throw error;
  }
};

// Helper sleep
const sleep = (ms) => new Promise((res) => setTimeout(res, ms));

/**
 * Fetch athlete activities since a given unix timestamp (seconds).
 * Handles pagination and basic rate limit (429) backoff / Retry-After header.
 */
export const getAthleteActivitiesSince = async (
  accessToken,
  afterTimestamp,
  perPage = 100
) => {
  try {
    let allActivities = [];
    let page = 1;
    let hasMoreData = true;

    // We'll do retries with exponential backoff for transient 429/5xx errors
    const maxRetries = 5;

    while (hasMoreData) {
      let attempt = 0;
      let response = null;

      while (attempt <= maxRetries) {
        try {
          response = await axios.get(`${STRAVA_API_BASE}/athlete/activities`, {
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
            params: {
              after: afterTimestamp,
              page,
              per_page: perPage,
            },
            validateStatus: (status) => true, // we'll handle statuses manually
          });

          // Handle rate limit
          if (response.status === 429) {
            const retryAfter = parseInt(response.headers['retry-after']) || null;
            const backoffMs = retryAfter ? retryAfter * 1000 : Math.pow(2, attempt) * 1000;
            console.warn(`Strava rate limit hit (429). Backing off for ${backoffMs}ms (attempt ${attempt + 1})`);
            await sleep(backoffMs);
            attempt++;
            continue;
          }

          // Handle server errors with backoff
          if (response.status >= 500 && response.status < 600) {
            const backoffMs = Math.pow(2, attempt) * 1000;
            console.warn(`Strava server error ${response.status}. Backing off ${backoffMs}ms (attempt ${attempt + 1})`);
            await sleep(backoffMs);
            attempt++;
            continue;
          }

          // For 401/403 treat as auth error
          if (response.status === 401 || response.status === 403) {
            const err = new Error(`Authentication error when calling Strava API: ${response.status}`);
            err.response = response;
            throw err;
          }

          // If we reach here and response is OK (200)
          if (response.status === 200) break;

          // For other 4xx errors, throw
          const err = new Error(`Unexpected response from Strava API: ${response.status}`);
          err.response = response;
          throw err;
        } catch (err) {
          if (attempt >= maxRetries) throw err;
          const backoffMs = Math.pow(2, attempt) * 1000;
          console.warn(`Error fetching activities (attempt ${attempt + 1}): ${err.message}. Backing off ${backoffMs}ms`);
          await sleep(backoffMs);
          attempt++;
        }
      }

      if (!response) break; // safety

      const activities = response.data || [];

      if (!Array.isArray(activities) || activities.length === 0) {
        hasMoreData = false;
      } else {
        allActivities = allActivities.concat(activities);
        if (activities.length < perPage) {
          hasMoreData = false;
        } else {
          page++;
          // Gentle delay between pages to reduce chance of rate limiting
          await sleep(250);
        }
      }
    }

    return allActivities;
  } catch (error) {
    console.error('Error fetching activities since timestamp:', error);
    throw error;
  }
};

// Get athlete profile
export const getAthlete = async (accessToken) => {
  try {
    const response = await axios.get(`${STRAVA_API_BASE}/athlete`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
    return response.data;
  } catch (error) {
    console.error('Error fetching athlete:', error);
    throw error;
  }
};

// Get athlete stats
export const getAthleteStats = async (accessToken, athleteId) => {
  try {
    const response = await axios.get(`${STRAVA_API_BASE}/athletes/${athleteId}/stats`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
    return response.data;
  } catch (error) {
    console.error('Error fetching athlete stats:', error);
    throw error;
  }
};

// Storage helpers
export const storeAuthData = (data) => {
  localStorage.setItem('strava_access_token', data.access_token);
  localStorage.setItem('strava_refresh_token', data.refresh_token);
  localStorage.setItem('strava_expires_at', data.expires_at);
  if (data.athlete) {
    localStorage.setItem('strava_athlete', JSON.stringify(data.athlete));
  }
};

export const getStoredAuthData = () => {
  const accessToken = localStorage.getItem('strava_access_token');
  const refreshToken = localStorage.getItem('strava_refresh_token');
  const expiresAt = localStorage.getItem('strava_expires_at');
  const athlete = localStorage.getItem('strava_athlete');
  
  if (!accessToken) return null;
  
  return {
    accessToken,
    refreshToken,
    expiresAt: parseInt(expiresAt),
    athlete: athlete ? JSON.parse(athlete) : null,
  };
};

export const clearAuthData = () => {
  localStorage.removeItem('strava_access_token');
  localStorage.removeItem('strava_refresh_token');
  localStorage.removeItem('strava_expires_at');
  localStorage.removeItem('strava_athlete');
};

export const isTokenExpired = () => {
  const expiresAt = localStorage.getItem('strava_expires_at');
  if (!expiresAt) return true;
  return Date.now() / 1000 > parseInt(expiresAt);
};
