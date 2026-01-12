# Home Page Metrics Implementation

## ✅ What's Implemented

### 1. **Performance Management Chart (PMC) Metrics**
All three key metrics are now calculated from real data:

- **CTL (Chronic Training Load / Fitness)**: 42-day exponentially weighted average of daily TSS
  - Formula: `CTL_today = CTL_yesterday + (TSS - CTL_yesterday) / 42`
  - Shows long-term fitness trend
  
- **ATL (Acute Training Load / Fatigue)**: 7-day exponentially weighted average of daily TSS
  - Formula: `ATL_today = ATL_yesterday + (TSS - ATL_yesterday) / 7`
  - Shows short-term training load
  
- **TSB (Training Stress Balance / Form)**: Difference between CTL and ATL
  - Formula: `TSB = CTL - ATL`
  - Negative values (-10 to -30) indicate optimal training zone
  - Positive values indicate freshness/recovery

### 2. **Weekly TSS Progress**
- Calculates total TSS from last 7 days of activities
- Compares against target (currently hardcoded to 600)
- Dynamic progress bar with color coding:
  - Green: ≥100% of target
  - Blue: ≥70% of target
  - Yellow: <70% of target

### 3. **TSS Calculation Methods**
Activities get TSS calculated using (in priority order):
1. **Power-based TSS** (if power meter data available)
   - Most accurate for cycling
   - Uses Normalized Power (NP) and Functional Threshold Power (FTP)
   
2. **Heart Rate-based TSS** (if HR data available)
   - Uses TRIMP (Training Impulse) method
   - Requires max HR, resting HR, and LTHR settings
   
3. **Duration-based estimation** (fallback)
   - 50 TSS per hour as baseline

### 4. **Data Sources**
- Activities fetched from Firebase (last 500 activities)
- Athlete settings (FTP, HR zones) from Firebase profile/settings
- Planned workouts from Firebase planned_workouts collection

## 📊 What Data is Available

### From Strava Activities (stored in Firebase):
- Distance, duration (moving_time, elapsed_time)
- Heart rate data (average_heartrate, max_heartrate)
- Power data (weighted_average_power for rides)
- Activity type, sport type
- Date/time information
- **Calculated TSS** (stored when activity is synced)

### From Athlete Settings:
- Max Heart Rate
- Resting Heart Rate
- LTHR (Lactate Threshold Heart Rate)
- FTP (Functional Threshold Power)

Users can configure these in [Settings](/settings).

## 🔄 How It Works

### Initial Load
1. Page loads → Checks authentication
2. If authenticated → Fetches athlete ID
3. Calls `fetchPMCMetrics(athleteId)` which:
   - Gets athlete settings (for accurate TSS calculation)
   - Fetches last 500 activities from Firebase
   - Calculates PMC data using `calculatePMC()` function
   - Extracts latest CTL/ATL/TSB values
   - Calculates weekly TSS from last 7 days

### Manual Refresh
- Click "Sync Metrics" button
- Re-fetches activities and recalculates all metrics
- Updates "Last sync" timestamp

## 🎯 Dynamic Features

### Metric Descriptions
Descriptions change based on actual values:

**CTL (Fitness)**:
- <30: "Building base"
- 30-60: "Good fitness level"
- >60: "Elite fitness"

**ATL (Fatigue)**:
- <40: "Low fatigue"
- 40-80: "Moderate loading"
- >80: "High training load"

**TSB (Form)**:
- <-30: "Risk of overtraining" (red)
- -30 to -10: "Optimal training zone" (green)
- -10 to 10: "Maintaining fitness" (blue)
- >10: "Fresh & rested" (blue)

## 🚧 What Could Be Enhanced

### 1. **Readiness Score**
Currently showing hardcoded value (84). Could calculate from:
- Recent TSB trend
- Sleep data (if integrated)
- HRV data (if available from wearables)
- Recovery days vs training days ratio

### 2. **Weekly Target TSS**
Currently hardcoded to 600. Could be:
- Set by user in settings
- Calculated from training plan
- Auto-adjusted based on fitness level (CTL)

### 3. **AI Recommendations**
Currently hardcoded. Could generate based on:
- Current TSB value
- Recent training pattern
- Upcoming planned workouts
- CTL/ATL trends

### 4. **More HR Analytics**
If HR data available:
- Average resting HR trend
- HR zones distribution
- Cardiac drift analysis
- Efficiency factor

### 5. **Real-time Sync**
Currently manual. Could add:
- Auto-refresh on interval
- WebSocket for real-time updates
- Background sync with Strava webhooks

## 📝 User Action Items

To get the most accurate metrics, users should:

1. **Configure Settings** ([/settings](/settings)):
   - Set accurate Max Heart Rate
   - Set Resting Heart Rate
   - Set LTHR (Lactate Threshold Heart Rate)
   - Set FTP (Functional Threshold Power) for cycling

2. **Sync Strava Activities**:
   - Go to [Activities](/activities) page
   - Click "Sync from Strava"
   - This ensures TSS is calculated for all activities

3. **Regular Training**:
   - The more data, the more accurate the metrics
   - PMC calculations need at least 2-3 weeks of data for meaningful trends

## 🔍 Data Requirements Summary

| Metric | Required Data | Currently Available? |
|--------|---------------|---------------------|
| CTL/ATL/TSB | TSS for each activity | ✅ Yes (calculated) |
| Weekly TSS | Activities from last 7 days | ✅ Yes |
| Power-based TSS | Weighted avg power + FTP | ✅ Yes (if power meter) |
| HR-based TSS | Avg HR + HR zones | ✅ Yes (if HR monitor) |
| Readiness Score | HRV, sleep, recovery metrics | ⚠️ Partial (calculated from TSB) |
| AI Recommendations | Training context + PMC data | ⚠️ Needs AI integration |

## ✨ Summary

The Home page now displays **real, calculated metrics** based on actual Strava activity data. All the core PMC metrics (CTL, ATL, TSB) and weekly TSS tracking are fully functional and update based on your training data.

The system has all the infrastructure needed. The main enhancements would be around more advanced features like readiness scoring and AI-powered recommendations, which would require additional data integrations or ML models.
