import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
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
import { AppLayout } from './components/layout/AppLayout';
import './App.css';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/callback" element={<Callback />} />
        <Route
          path="*"
          element={
            <AppLayout>
              <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/activities" element={<Activities />} />
                <Route path="/activities/:id" element={<ActivityDetail />} />
                <Route path="/calendar" element={<TrainingCalendar />} />
                <Route path="/planner" element={<Planner />} />
                <Route path="/planner-demo" element={<PlannerDemo />} />
                <Route path="/chat" element={<Chat />} />
                <Route path="/prs" element={<PersonalRecords />} />
                <Route path="/admin" element={<AdminPanel />} />
                <Route path="/year-stats" element={<YearStats />} />
                <Route path="/settings" element={<AthleteSettings />} />
              </Routes>
            </AppLayout>
          }
        />
      </Routes>
    </Router>
  );
}

export default App;
