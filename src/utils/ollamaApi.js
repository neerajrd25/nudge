import axios from 'axios';

// Get Ollama API URL from environment variables
const getOllamaUrl = () => {
  return import.meta.env.VITE_OLLAMA_API_URL || 'http://localhost:11434';
};

/**
 * Send a chat message to Ollama model
 * @param {string} model - The model name (e.g., 'llama2', 'mistral')
 * @param {Array} messages - Array of message objects with role and content
 * @param {Function} onChunk - Callback function for streaming responses
 * @returns {Promise<string>} - The complete response text
 */
export const sendChatMessage = async (model, messages, onChunk = null) => {
  const url = `${getOllamaUrl()}/api/chat`;
  
  try {
    if (onChunk) {
      // Streaming mode
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          messages,
          stream: true,
        }),
      });

      if (!response.ok) {
        throw new Error(`Ollama API error: ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let fullResponse = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n').filter(line => line.trim());

        for (const line of lines) {
          try {
            const json = JSON.parse(line);
            if (json.message && json.message.content) {
              fullResponse += json.message.content;
              onChunk(json.message.content);
            }
          } catch {
            // Ignore parsing errors for incomplete chunks
          }
        }
      }

      return fullResponse;
    } else {
      // Non-streaming mode
      const response = await axios.post(url, {
        model,
        messages,
        stream: false,
      });

      return response.data.message.content;
    }
  } catch (error) {
    console.error('Error calling Ollama API:', error);
    throw error;
  }
};

/**
 * List available models from Ollama
 * @returns {Promise<Array>} - Array of model objects
 */
export const listModels = async () => {
  const url = `${getOllamaUrl()}/api/tags`;
  
  try {
    const response = await axios.get(url);
    return response.data.models || [];
  } catch (error) {
    console.error('Error listing Ollama models:', error);
    throw error;
  }
};

/**
 * Check if Ollama server is running
 * @returns {Promise<boolean>} - True if server is running
 */
export const checkOllamaHealth = async () => {
  const url = `${getOllamaUrl()}/api/tags`;
  
  try {
    await axios.get(url, { timeout: 3000 });
    return true;
  } catch {
    return false;
  }
};
