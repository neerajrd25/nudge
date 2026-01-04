# Planner Component - Quick Start Guide

## 🚀 Getting Started

Your new Planner component is ready to use! Here's how to access it:

### 1. View the Demo (Recommended First Step)
```
http://localhost:5173/planner-demo
```
This interactive demo lets you:
- Test with sample data
- Generate random training plans
- Upload your own CSV files
- Edit CSV data in real-time

### 2. Use with Your Training Plan
```
http://localhost:5173/planner
```
This loads your actual `Training_plan.csv` file and displays it in the calendar.

## 📁 Files Created

```
src/pages/
  ├── Planner.jsx           # Main component
  ├── Planner.css           # Component styles
  ├── PlannerExample.jsx    # Integration with Training_plan.csv
  ├── PlannerDemo.jsx       # Interactive demo page
  └── PlannerDemo.css       # Demo page styles

src/utils/
  ├── plannerHelpers.js     # CSV conversion & utilities
  └── samplePlannerData.js  # Sample data for testing

public/
  └── Training_plan.csv     # Your training plan (copied)

PLANNER_README.md           # Full documentation
QUICK_START.md              # This file
```

## 🎯 Three Ways to Use the Planner

### Option 1: With Your Training Plan (Easiest)
```jsx
import PlannerExample from './pages/PlannerExample';

// In your App.jsx (already added):
<Route path="/planner" element={<PlannerExample />} />
```
Navigate to `/planner` to see your Training_plan.csv in calendar view.

### Option 2: With Custom CSV Data
```jsx
import Planner from './pages/Planner';

const myCsvData = `date,plannedActivity,plannedDuration,actualActivity,actualDuration,status
2026-01-04,Run - 10km,60,Run - 10km,58,done
2026-01-05,Rest,0,,,pending`;

function MyPage() {
  return <Planner csvData={myCsvData} />;
}
```

### Option 3: With Dynamic Data from API/Firebase
```jsx
import { useState, useEffect } from 'react';
import Planner from './pages/Planner';

function DynamicPlanner() {
  const [csvData, setCsvData] = useState('');

  useEffect(() => {
    // Load from your API or Firebase
    fetchTrainingData().then(data => {
      setCsvData(convertToCsv(data));
    });
  }, []);

  return <Planner csvData={csvData} />;
}
```

## 🎨 CSV Data Format

The Planner expects CSV data with these columns:

```csv
date,plannedActivity,plannedDuration,actualActivity,actualDuration,status
```

### Field Details:
- **date**: YYYY-MM-DD (e.g., 2026-01-04)
- **plannedActivity**: Activity description (e.g., "Run - 10km Easy")
- **plannedDuration**: Minutes (e.g., 60)
- **actualActivity**: What was actually done (optional, e.g., "Run - 9.5km")
- **actualDuration**: Actual minutes (optional, e.g., 58)
- **status**: One of: `pending`, `done`, `missed`

### Example Row:
```csv
2026-01-15,Run - 10km Steady,55,Run - 10km Steady,60,done
```

## 🔧 Converting Your Training_plan.csv

Your existing `Training_plan.csv` has a different format. The `plannerHelpers.js` utility automatically converts it:

```javascript
import { convertTrainingPlanToPlannerFormat } from './utils/plannerHelpers';

const converted = convertTrainingPlanToPlannerFormat(yourCsvString);
```

This is already done in `PlannerExample.jsx`!

## 🎯 Key Features

### Calendar Features:
- ✅ Month navigation (prev/next buttons)
- ✅ Color-coded status pills on each day
- ✅ Hover tooltips with activity counts
- ✅ Current day highlighting
- ✅ Weekend highlighting

### Detail Panel:
- ✅ Click any day to see details
- ✅ Shows all activities for that day
- ✅ Planned vs Actual comparison
- ✅ Duration variance calculation
- ✅ Status chips (done/pending/missed)
- ✅ "Mark as Complete" button (Firebase integration pending)

### Responsive Design:
- ✅ Desktop: Side panel layout
- ✅ Mobile: Bottom slide-up panel
- ✅ Touch-friendly interface

## 🔮 Next Steps

### 1. Add Navigation Link
Update your Home.jsx or navigation:

```jsx
<Link to="/planner">Training Planner</Link>
```

### 2. Connect to Firebase (Optional)
Implement the `saveActualActivity` function in `Planner.jsx`:

```javascript
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../utils/firebaseConfig';

async function saveActualActivity(itemId, payload) {
  const itemRef = doc(db, 'plannerItems', itemId);
  await updateDoc(itemRef, payload);
}
```

### 3. Integrate with Strava (Optional)
Use the stub in `plannerHelpers.js`:

```javascript
import { fetchActualActivitiesFromStrava } from './utils/plannerHelpers';
import { getActivities } from './stravaApi';

// Fetch actual activities and merge with plan
const actualData = await fetchActualActivitiesFromStrava('2026-01-01', '2026-01-31');
const merged = mergePlannedWithActual(plannedItems, actualData);
```

### 4. Customize Styling
Edit `Planner.css` to match your app's theme:
- Change colors
- Adjust spacing
- Modify fonts
- Update breakpoints

### 5. Add Features
Extend the component:
- Week view
- Export to PDF
- Activity templates
- Recurring activities
- Coach notes
- Performance graphs

## 🐛 Troubleshooting

### Calendar Not Showing
- Check that `react-calendar` is installed: `npm list react-calendar`
- Ensure CSS is imported in Planner.jsx

### CSV Not Parsing
- Verify date format is YYYY-MM-DD
- Check that headers are lowercase
- Ensure status is one of: pending, done, missed

### Mobile Panel Not Working
- Check viewport meta tag in index.html
- Test in responsive mode (Chrome DevTools)

### Training Plan Not Loading
- Verify Training_plan.csv is in `/public` folder
- Check browser console for errors
- Ensure file has correct headers

## 📚 Documentation

For comprehensive documentation, see:
- **PLANNER_README.md** - Full component API and examples
- **Planner.jsx** - Inline code comments
- **plannerHelpers.js** - Utility function docs

## 🚀 Start the Development Server

```bash
npm run dev
```

Then navigate to:
- Demo: http://localhost:5173/planner-demo
- Training Plan: http://localhost:5173/planner

## 💡 Tips

1. **Test with Demo First**: Use `/planner-demo` to experiment
2. **Start Simple**: Use the PlannerExample as a template
3. **CSV Editor**: Use the demo's CSV editor to test different data
4. **Mobile Testing**: Test on actual device for best results
5. **Console Logs**: Check browser console for parsing warnings

## 🎉 You're All Set!

Your Planner component is fully functional and ready to use. Start by visiting the demo page, then integrate it into your app workflow.

Happy training! 🏃‍♂️🚴‍♂️
