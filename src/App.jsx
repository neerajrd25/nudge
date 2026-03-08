import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Callback from './pages/Callback';
import Activities from './pages/Activities';
import ActivityDetail from './pages/ActivityDetail';
import TrainingCalendar from './pages/TrainingCalendar';
import Chat from './pages/Chat';
import PersonalRecords from './pages/PersonalRecords';
import AdminPanel from './pages/AdminPanel';
import YearStats from './pages/YearStats';
import Planner from './pages/Planner';
import PlannerDemo from './pages/PlannerDemo';
import AthleteSettings from './pages/AthleteSettings';
import Charts from './pages/Charts';
import Footprint from './pages/Footprint';
import { AuthProvider, useAuth } from './context/AuthContext';
import './App.css';
import { AppLayout } from './components/layout/AppLayout';
import Landing from './pages/Landing';
import Dashboard from './pages/Dashboard';
import { PublicLayout } from './components/layout/PublicLayout';

function App() {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return null; // Or a professional loading screen
  }

  return (
    <Router>
      <Routes>
        <Route path="/callback" element={<Callback />} />
        <Route
          path="*"
          element={
            isAuthenticated ? (
              <AppLayout>
                <Routes>
                  <Route path="/" element={<Dashboard />} />
                  <Route path="/activities" element={<Activities />} />
                  <Route path="/activities/:id" element={<ActivityDetail />} />
                  <Route path="/calendar" element={<TrainingCalendar />} />
                  <Route path="/planner" element={<Planner />} />
                  <Route path="/planner-demo" element={<PlannerDemo />} />
                  <Route path="/chat" element={<Chat />} />
                  <Route path="/charts" element={<Charts />} />
                  <Route path="/prs" element={<PersonalRecords />} />
                  <Route path="/footprint" element={<Footprint />} />
                  <Route path="/admin" element={<AdminPanel />} />
                  <Route path="/year-stats" element={<YearStats />} />
                  <Route path="/settings" element={<AthleteSettings />} />
                </Routes>
              </AppLayout>
            ) : (
              <PublicLayout fullWidth>
                <Routes>
                  <Route path="/" element={<Landing />} />
                  <Route path="*" element={<Landing />} />
                </Routes>
              </PublicLayout>
            )
          }
        />
      </Routes>
    </Router>
  );
}

export default App;
