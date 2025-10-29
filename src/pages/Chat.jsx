import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  getStoredAuthData, 
  getAthleteActivities,
  refreshAccessToken,
  storeAuthData,
  isTokenExpired 
} from '../utils/stravaApi';
import { sendChatMessage, listModels, checkOllamaHealth } from '../utils/ollamaApi';
import './Chat.css';

function Chat() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [ollamaStatus, setOllamaStatus] = useState('checking');
  const [selectedModel, setSelectedModel] = useState('llama2');
  const [availableModels, setAvailableModels] = useState([]);
  const [activities, setActivities] = useState([]);
  const messagesEndRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    checkOllamaConnection();
    loadActivitiesForContext();
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const checkOllamaConnection = async () => {
    try {
      const isHealthy = await checkOllamaHealth();
      if (isHealthy) {
        setOllamaStatus('connected');
        const models = await listModels();
        setAvailableModels(models);
        if (models.length > 0) {
          setSelectedModel(models[0].name);
        }
      } else {
        setOllamaStatus('disconnected');
      }
    } catch (err) {
      console.error('Error checking Ollama connection:', err);
      setOllamaStatus('disconnected');
    }
  };

  const loadActivitiesForContext = async () => {
    try {
      const authData = getStoredAuthData();
      
      if (!authData || !authData.accessToken) {
        return;
      }

      let accessToken = authData.accessToken;

      if (isTokenExpired() && authData.refreshToken) {
        const newAuthData = await refreshAccessToken(authData.refreshToken);
        storeAuthData(newAuthData);
        accessToken = newAuthData.access_token;
      }

      const data = await getAthleteActivities(accessToken, 1, 10);
      setActivities(data);
    } catch (err) {
      console.error('Error loading activities:', err);
    }
  };

  const formatActivityContext = () => {
    if (activities.length === 0) return '';

    const activitySummary = activities.map(activity => {
      const distance = (activity.distance / 1000).toFixed(2);
      const duration = Math.floor(activity.moving_time / 60);
      return `- ${activity.name} (${activity.type}): ${distance}km in ${duration} minutes on ${new Date(activity.start_date).toLocaleDateString()}`;
    }).join('\n');

    return `\n\nHere are my recent activities:\n${activitySummary}`;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!input.trim() || loading || ollamaStatus !== 'connected') return;

    const userMessage = {
      role: 'user',
      content: input.trim(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      const conversationHistory = [...messages, userMessage];
      
      // Add system context with activities
      const systemMessage = {
        role: 'system',
        content: `You are a helpful AI training assistant. You help athletes analyze their training activities and provide advice. Be encouraging and specific in your recommendations.${formatActivityContext()}`,
      };

      const messagesToSend = [systemMessage, ...conversationHistory];

      let assistantMessage = {
        role: 'assistant',
        content: '',
      };

      setMessages(prev => [...prev, assistantMessage]);

      await sendChatMessage(
        selectedModel,
        messagesToSend,
        (chunk) => {
          assistantMessage.content += chunk;
          setMessages(prev => {
            const newMessages = [...prev];
            newMessages[newMessages.length - 1] = { ...assistantMessage };
            return newMessages;
          });
        }
      );
    } catch (error) {
      console.error('Error sending message:', error);
      const errorMessage = {
        role: 'assistant',
        content: 'Sorry, I encountered an error. Please make sure Ollama is running and try again.',
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  const handleRetryConnection = () => {
    setOllamaStatus('checking');
    checkOllamaConnection();
  };

  return (
    <div className="chat">
      <header className="chat-header">
        <button className="back-btn" onClick={() => navigate('/')}>
          ← Back
        </button>
        <div className="header-content">
          <h1>💬 AI Training Chat</h1>
          <div className="header-info">
            <div className={`status-indicator ${ollamaStatus}`}>
              <span className="status-dot"></span>
              {ollamaStatus === 'connected' && 'Connected to Ollama'}
              {ollamaStatus === 'disconnected' && 'Ollama Disconnected'}
              {ollamaStatus === 'checking' && 'Checking connection...'}
            </div>
            {availableModels.length > 0 && (
              <select 
                value={selectedModel} 
                onChange={(e) => setSelectedModel(e.target.value)}
                className="model-selector"
                disabled={loading}
              >
                {availableModels.map((model) => (
                  <option key={model.name} value={model.name}>
                    {model.name}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>
      </header>

      <main className="chat-main">
        {ollamaStatus === 'disconnected' && (
          <div className="connection-error">
            <div className="error-content">
              <span className="error-icon">⚠️</span>
              <h3>Ollama Not Connected</h3>
              <p>
                Please make sure Ollama is installed and running on your system.
              </p>
              <p className="error-hint">
                Start Ollama by running: <code>ollama serve</code>
              </p>
              <button onClick={handleRetryConnection} className="retry-btn">
                Retry Connection
              </button>
            </div>
          </div>
        )}

        {ollamaStatus === 'connected' && (
          <>
            <div className="messages-container">
              {messages.length === 0 && (
                <div className="welcome-message">
                  <span className="welcome-icon">👋</span>
                  <h2>Welcome to AI Training Chat!</h2>
                  <p>Ask me anything about your training activities, get advice, or discuss your fitness goals.</p>
                  <div className="suggestion-chips">
                    <button 
                      onClick={() => setInput('How has my training been this week?')}
                      className="suggestion-chip"
                    >
                      How has my training been?
                    </button>
                    <button 
                      onClick={() => setInput('What should I focus on next?')}
                      className="suggestion-chip"
                    >
                      What should I focus on?
                    </button>
                    <button 
                      onClick={() => setInput('Analyze my recent running activities')}
                      className="suggestion-chip"
                    >
                      Analyze my activities
                    </button>
                  </div>
                </div>
              )}

              {messages.map((message, index) => (
                <div
                  key={index}
                  className={`message ${message.role}`}
                >
                  <div className="message-avatar">
                    {message.role === 'user' ? '👤' : '🤖'}
                  </div>
                  <div className="message-content">
                    <div className="message-text">{message.content}</div>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            <form className="chat-input-form" onSubmit={handleSubmit}>
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask about your training..."
                className="chat-input"
                disabled={loading}
              />
              <button 
                type="submit" 
                className="send-btn" 
                disabled={loading || !input.trim()}
              >
                {loading ? '⏳' : '📤'}
              </button>
            </form>
          </>
        )}
      </main>
    </div>
  );
}

export default Chat;
