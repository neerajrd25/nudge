import axios from 'axios';

const STRAVA_API_BASE = 'https://www.strava.com/api/v3';
const STRAVA_AUTH_BASE = 'https://www.strava.com/oauth';

// Get configuration from environment variables
const getConfig = () => ({
  clientId: import.meta.env.VITE_STRAVA_CLIENT_ID,
  clientSecret: import.meta.env.VITE_STRAVA_CLIENT_SECRET,
  redirectUri: import.meta.env.VITE_STRAVA_REDIRECT_URI || 'http://localhost:5173/callback',
});

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

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

// Get athlete activities with optional range
export const getAthleteActivities = async (accessToken, page = 1, perPage = 30, after = null, before = null) => {
  try {
    const params = { page, per_page: perPage };
    
    const toUnix = (val) => {
      if (!val) return null;
      if (typeof val === 'number') return val;
      return Math.floor(new Date(val).getTime() / 1000);
    };

    const afterSec = toUnix(after);
    const beforeSec = toUnix(before);
    
    if (afterSec) params.after = afterSec;
    if (beforeSec) params.before = beforeSec;

    const response = await axios.get(`${STRAVA_API_BASE}/athlete/activities`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      params,
    });
    return response.data;
  } catch (error) {
    console.error('Error fetching activities:', error);
    throw error;
  }
};

// Get athlete activities since a given Unix timestamp (seconds). If afterSec is null, behaves like getAllAthleteActivities
export const getAthleteActivitiesSince = async (accessToken, afterSec = null) => {
  try {
    let allActivities = [];
    let page = 1;
    const perPage = 200;
    let hasMore = true;

    while (hasMore) {
      const params = { page, per_page: perPage };
      if (afterSec) params.after = afterSec;

      const response = await axios.get(`${STRAVA_API_BASE}/athlete/activities`, {
        headers: { Authorization: `Bearer ${accessToken}` },
        params,
      });

      const activities = response.data;
      if (!activities || activities.length === 0) {
        hasMore = false;
      } else {
        allActivities = allActivities.concat(activities);
        if (activities.length < perPage) {
          hasMore = false;
        } else {
          page++;
          // Gentle delay between pages to reduce chance of rate limiting
          await sleep(250);
        }
      }
    }

    return allActivities;
  } catch (error) {
    console.error('Error fetching athlete activities since:', error);
    throw error;
  }
};

// Get athlete activities for the last 3 months
// NOTE: The 3-month-specific activity fetch was removed. Use `getAllAthleteActivities`
// or `getAthleteActivities` for targeted queries.

// Get ALL athlete activities (paginated) from Strava
export const getAllAthleteActivities = async (accessToken) => {
  try {
    let allActivities = [];
    let page = 1;
    const perPage = 200; // keep a reasonably large page size
    let hasMore = true;

    while (hasMore) {
      const response = await axios.get(`${STRAVA_API_BASE}/athlete/activities`, {
        headers: { Authorization: `Bearer ${accessToken}` },
        params: { page, per_page: perPage },
      });

      const activities = response.data;
      if (!activities || activities.length === 0) {
        hasMore = false;
      } else {
        allActivities = allActivities.concat(activities);
        if (activities.length < perPage) {
          hasMore = false;
        } else {
          page++;
          // Gentle delay between pages to reduce chance of rate limiting
          await sleep(250);
        }
      }
    }

    return allActivities;
  } catch (error) {
    console.error('Error fetching all athlete activities:', error);
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

// Get detailed activity (includes best efforts)
export const getActivityById = async (accessToken, activityId) => {
  try {
    const response = await axios.get(`${STRAVA_API_BASE}/activities/${activityId}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
    return response.data;
  } catch (error) {
    console.error('Error fetching activity details:', error);
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
