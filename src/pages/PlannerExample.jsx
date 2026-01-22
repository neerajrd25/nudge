import { useState, useEffect } from 'react';
import Planner from './Planner';
import { loadTrainingPlanFromFile } from '../utils/plannerHelpers';

/**
 * Example implementation showing how to use the Planner component
 * with your existing Training_plan.csv file
 */
const PlannerExample = () => {
  const [csvData, setCsvData] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadPlannerData();
  }, []);

  const loadPlannerData = async () => {
    try {
      setLoading(true);
      // Load the Training_plan.csv from public folder
      const converted = await loadTrainingPlanFromFile('/Training_plan.csv');
      setCsvData(converted);
    } catch (err) {
      console.error('Error loading planner data:', err);
      setError('Failed to load training plan');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <p>Loading training plan...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', color: '#dc2626' }}>
        <p>{error}</p>
        <button onClick={loadPlannerData}>Retry</button>
      </div>
    );
  }

  return <Planner csvData={csvData} />;
};

export default PlannerExample;
