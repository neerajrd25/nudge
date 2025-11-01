import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import Callback from './pages/Callback';
import Activities from './pages/Activities';
import TrainingCalendar from './pages/TrainingCalendar';
import Chat from './pages/Chat';
import PersonalRecords from './pages/PersonalRecords';
import './App.css';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/callback" element={<Callback />} />
        <Route path="/activities" element={<Activities />} />
        <Route path="/calendar" element={<TrainingCalendar />} />
        <Route path="/chat" element={<Chat />} />
        <Route path="/pr" element={<PersonalRecords />} />
      </Routes>
    </Router>
  );
}

export default App;
