# Fitness Analytics Charts - Documentation

## Overview
The Charts page provides comprehensive fitness analytics for Strava running data with real-time updates from Firestore. It uses Grade-Adjusted Pace (GAP) to normalize performance across different terrains.

## Features

### 📊 Visualizations
1. **GAP Trend Line Chart** - Shows performance improvement over time with trend line
2. **Scatter Plot Analysis** - GAP vs Heart Rate with bubble size representing distance
3. **Recent 10 Runs Table** - Detailed stats with efficiency scores

### 🎯 Key Metrics
- **Grade-Adjusted Pace (GAP)**: Pace adjusted for elevation gain using Jack Daniels model
- **Efficiency Score**: GAP × HR (lower is better)
- **Improvement %**: Comparison against average performance
- **Trend Analysis**: Recent vs historical performance

### 🔧 Interactive Features
- **Dynamic Filters**: Distance range (3-15km by default)
- **Date Range**: Last 2 years of running data
- **Real-time Updates**: Automatically syncs with Firestore
- **Export to PNG**: Download charts for sharing

## Technical Implementation

### Files Created
- `/src/pages/Charts.tsx` - Main component with Recharts visualizations
- `/src/hooks/useFitnessData.ts` - Custom hook for data fetching and processing
- `/src/types/strava.ts` - TypeScript interfaces

### Dependencies Added
```json
{
  "recharts": "Interactive charts library",
  "d3-regression": "Linear regression for trend lines",
  "html-to-image": "Export charts to PNG"
}
```

### Data Flow
1. **Firestore Query**: Real-time listener on `athletes/{id}/activities`
2. **Filtering**: Type='Run', distance 3-15km, heart rate >0, last 2 years
3. **GAP Calculation**: `pace * (1 + elevationGain/distance * 100 * 0.08)`
4. **Visualization**: Recharts renders interactive charts

### Performance
- ✅ Real-time onSnapshot updates (<100ms)
- ✅ Memoized calculations (React useMemo)
- ✅ Efficient filtering and sorting
- ✅ Responsive design (mobile-first)

## Usage

### Accessing Charts
Navigate to `/charts` or add a link in your navigation:
```jsx
<Link to="/charts">Fitness Analytics</Link>
```

### Data Requirements
Activities in Firestore must have:
- `type`: 'Run'
- `distance`: meters (3000-15000 for default view)
- `average_speed`: m/s
- `average_heartrate`: bpm
- `total_elevation_gain`: meters
- `start_date`: ISO timestamp

### Customization

#### Adjust Distance Range
```typescript
// In useFitnessData.ts, line ~68
minDistance: 3, // km - change default
maxDistance: 15, // km - change default
```

#### Change Time Window
```typescript
// In useFitnessData.ts, line ~85
twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2); // Change -2 to desired years
```

#### GAP Formula Tuning
```typescript
// In useFitnessData.ts, line ~25
const gapFactor = 1 + (gradePercent * 0.08); // 0.08 = 8% per 1% grade
```

## Formulas

### Grade-Adjusted Pace (GAP)
```
pace = 1000 / (avgSpeed * 60)  // Convert m/s to min/km
gradePercent = (elevationGain / distance) * 100
gapFactor = 1 + (gradePercent * 0.08)  // Jack Daniels model
GAP = pace * gapFactor
```

### Efficiency Score
```
efficiency = GAP * avgHeartRate
```
Lower score = more efficient running (faster pace with lower heart rate)

### Improvement Percentage
```
improvementPercent = ((avgGAP - runGAP) / avgGAP) * 100
```
Positive % = faster than average, Negative % = slower than average

## Color Coding

### Scatter Plot
- **Blue dots**: Oldest runs
- **Red dots**: Newest runs  
- **Gradient**: Blue → Purple → Red (chronological)
- **Size**: Larger bubbles = longer distance

### Stats Cards
- **Green**: Improving trend
- **Red**: Declining trend
- **Gray**: Stable performance

## Accessibility
- ✅ Keyboard navigation
- ✅ ARIA labels on charts
- ✅ High contrast tooltips
- ✅ Responsive text sizing

## Troubleshooting

### No data showing?
1. Verify Firestore has activities with `type: 'Run'`
2. Check activities are within last 2 years
3. Ensure activities have `average_heartrate > 0`
4. Verify distance is 3-15km

### TypeScript errors?
The hook uses `@ts-expect-error` for JS firebaseConfig imports. This is expected and safe.

### Export not working?
1. Check browser permissions for downloads
2. Ensure chart ref is properly mounted
3. Try different browser (Chrome/Firefox recommended)

## Future Enhancements
- [ ] Training load trends (CTL/ATL/TSB)
- [ ] Race predictor based on GAP
- [ ] VO2 max estimation
- [ ] Heat map calendar view
- [ ] Comparison with other athletes
- [ ] AI-powered insights

## Support
For issues or questions, check the Firestore console for activity data structure and ensure all required fields are present.
