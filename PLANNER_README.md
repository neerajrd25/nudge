# Planner Component - Training Plan Tracker

A comprehensive month-view calendar component for tracking planned vs actual training activities.

## Features

### ✨ Core Functionality
- **Month-view calendar** with planned vs actual activity tracking
- **CSV-driven data** - easily import training plans
- **Color-coded status pills** - visual indicators for done/pending/missed activities
- **Interactive day detail panel** - click any day to see full activity details
- **Duration variance tracking** - compare planned vs actual workout durations
- **Responsive design** - optimized for desktop and mobile

### 📊 Data Structure

The Planner expects CSV data with the following structure:

```csv
date,plannedActivity,plannedDuration,actualActivity,actualDuration,status
2026-01-04,Run - 10km Easy,60,Run - 10km Easy,58,done
2026-01-05,Rest/Mobility,20,,,pending
2026-01-06,Run - 6km Easy,36,,,pending
```

**Field Definitions:**
- `date`: YYYY-MM-DD format
- `plannedActivity`: Description of planned workout
- `plannedDuration`: Duration in minutes
- `actualActivity`: What was actually done (optional)
- `actualDuration`: Actual duration in minutes (optional)
- `status`: One of "pending" | "done" | "missed"

## Usage

### Basic Usage

```jsx
import Planner from './pages/Planner';

function MyApp() {
  const csvData = `
date,plannedActivity,plannedDuration,actualActivity,actualDuration,status
2026-01-04,Run - 10km Easy,60,,,pending
2026-01-05,Cycle - 50km,120,,,pending
  `;

  return <Planner csvData={csvData} />;
}
```

### Using with Training_plan.csv

The included `PlannerExample.jsx` shows how to load and convert your existing `Training_plan.csv`:

```jsx
import PlannerExample from './pages/PlannerExample';

function App() {
  return <PlannerExample />;
}
```

Access it at: `http://localhost:5173/planner`

### Helper Utilities

The `plannerHelpers.js` provides utilities for working with training data:

```javascript
import { 
  convertTrainingPlanToPlannerFormat,
  loadTrainingPlanFromFile,
  mergePlannedWithActual 
} from './utils/plannerHelpers';

// Convert your Training_plan.csv format
const converted = convertTrainingPlanToPlannerFormat(rawCsv);

// Load from file
const data = await loadTrainingPlanFromFile('/Training_plan.csv');

// Merge with Strava actual data (TODO)
const merged = mergePlannedWithActual(plannedItems, actualData);
```

## Component API

### Props

```typescript
interface PlannerProps {
  csvData: string;        // CSV string with activity data
  initialDate?: Date;     // Default: new Date()
}
```

### TypeScript Types

```typescript
type PlannerItem = {
  date: string;                              // YYYY-MM-DD
  plannedActivity: string;
  plannedDuration: number;                   // minutes
  actualActivity?: string;
  actualDuration?: number;                   // minutes
  status: "pending" | "done" | "missed";
};
```

## UI Components

### Calendar View
- Color-coded status pills on each day
- Hover tooltips showing activity counts
- Navigation between months
- Highlights for current day and weekends

### Status Colors
- 🟢 **Green** - Done: Activity completed
- 🔴 **Red** - Missed: Activity not completed
- ⚪ **Gray** - Pending: Activity not yet due

### Detail Panel
- Opens on day click
- Shows all activities for selected date
- Displays planned vs actual comparison
- Calculates duration variance
- "Mark as Complete" button for pending activities

### Responsive Design
- Desktop: Side panel layout
- Mobile: Bottom slide-up panel with overlay

## Firebase Integration (Stub)

The component includes placeholder functions for future Firebase integration:

```javascript
// Save actual activity data
async function saveActualActivity(itemId, payload) {
  // TODO: Implement Firebase Firestore integration
  console.log('Saving to Firebase:', { itemId, payload });
}
```

### Future Implementation

```javascript
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../utils/firebaseConfig';

async function saveActualActivity(itemId, payload) {
  const itemRef = doc(db, 'plannerItems', itemId);
  await updateDoc(itemRef, {
    actualActivity: payload.actualActivity,
    actualDuration: payload.actualDuration,
    status: payload.status,
    updatedAt: new Date().toISOString(),
  });
}
```

## Strava Integration (TODO)

The `plannerHelpers.js` includes a stub for fetching actual activities from Strava:

```javascript
import { fetchActualActivitiesFromStrava } from './utils/plannerHelpers';

// Fetch Strava activities for date range
const actualData = await fetchActualActivitiesFromStrava('2026-01-01', '2026-01-31');

// Merge with planned data
const merged = mergePlannedWithActual(plannedItems, actualData);
```

## Customization

### Styling
The component uses `Planner.css` for all styles. Key CSS classes:

- `.planner-container` - Main container
- `.planner-calendar` - Calendar wrapper
- `.status-pill` - Day cell status indicators
- `.detail-panel` - Side/bottom panel
- `.activity-card` - Individual activity cards

### Duration Estimation
Customize the `estimateDuration()` function in `plannerHelpers.js`:

```javascript
function estimateDuration(activity, details) {
  if (activity.toLowerCase().includes('run')) {
    // Your custom logic
    return 45;
  }
  // ...
}
```

## Development

### Running the App
```bash
npm run dev
# Navigate to http://localhost:5173/planner
```

### Adding to Navigation
Update your Home.jsx or navigation component:

```jsx
<Link to="/planner">Training Planner</Link>
```

## Examples

### Example 1: Basic Usage
```jsx
const basicCsv = `
date,plannedActivity,plannedDuration,actualActivity,actualDuration,status
2026-01-15,Morning Run,45,Morning Run,42,done
2026-01-16,Strength Training,60,,,pending
`;

<Planner csvData={basicCsv} />
```

### Example 2: With Initial Date
```jsx
const startDate = new Date('2026-01-01');
<Planner csvData={csvData} initialDate={startDate} />
```

### Example 3: Dynamic Data
```jsx
function DynamicPlanner() {
  const [data, setData] = useState('');

  useEffect(() => {
    // Load from API, file, or Firebase
    loadData().then(setData);
  }, []);

  return <Planner csvData={data} />;
}
```

## Browser Support

- Chrome/Edge (latest)
- Firefox (latest)
- Safari (latest)
- Mobile browsers (iOS Safari, Chrome Mobile)

## Dependencies

- `react` ^19.1.1
- `react-calendar` ^6.0.0
- `react-router-dom` ^7.9.4

## Future Enhancements

- [ ] Firebase Firestore integration for data persistence
- [ ] Strava API integration for actual activity sync
- [ ] Edit/update activities inline
- [ ] Drag-and-drop to reschedule activities
- [ ] Export to PDF/CSV
- [ ] Weekly/daily view options
- [ ] Activity templates
- [ ] Performance analytics dashboard
- [ ] Coach notes and feedback
- [ ] Multi-athlete support

## Troubleshooting

### Calendar Not Displaying
Ensure `react-calendar` CSS is imported:
```jsx
import 'react-calendar/dist/Calendar.css';
```

### CSV Not Parsing
Check CSV format:
- Headers must be lowercase
- Date format: YYYY-MM-DD
- Duration must be numeric
- Status must be: pending, done, or missed

### Mobile Panel Not Sliding
Check viewport meta tag in `index.html`:
```html
<meta name="viewport" content="width=device-width, initial-scale=1.0">
```

## License

Part of the Momentum.IQ training app.
