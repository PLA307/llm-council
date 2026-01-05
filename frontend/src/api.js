/**
 * API client for the LLM Council backend.
 */

// 使用环境变量或默认值，便于部署时配置
const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8001';

export const api = {
  /**
   * List all conversations.
   */
  async listConversations() {
    const response = await fetch(`${API_BASE}/api/conversations`);
    if (!response.ok) {
      throw new Error('Failed to list conversations');
    }
    return response.json();
  },

  /**
   * Create a new conversation.
   */
  async createConversation() {
    const response = await fetch(`${API_BASE}/api/conversations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({}),
    });
    if (!response.ok) {
      throw new Error('Failed to create conversation');
    }
    return response.json();
  },

  /**
   * Get a specific conversation.
   */
  async getConversation(conversationId) {
    const response = await fetch(
      `${API_BASE}/api/conversations/${conversationId}`
    );
    if (!response.ok) {
      throw new Error('Failed to get conversation');
    }
    return response.json();
  },

  /**
   * Send a message in a conversation.
   */
  async sendMessage(conversationId, content, quotedItems = [], fileData = []) {
    const apiKey = localStorage.getItem('openrouterApiKey') || '';
    const selectedModels = JSON.parse(localStorage.getItem('selectedModels') || '[]');
    const chairmanModel = localStorage.getItem('chairmanModel') || '';

    const response = await fetch(
      `${API_BASE}/api/conversations/${conversationId}/message`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          content,
          quoted_items: quotedItems,
          files: fileData,
          api_key: apiKey,
          council_models: selectedModels,
          chairman_model: chairmanModel
        }),
      }
    );
    if (!response.ok) {
      throw new Error('Failed to send message');
    }
    return response.json();
  },

  /**
   * Send a message and receive streaming updates.
   * @param {string} conversationId - The conversation ID
   * @param {string} content - The message content
   * @param {Array} quotedItems - The quoted items to include in the message
   * @param {Array} fileData - The file data to include in the message
   * @param {function} onEvent - Callback function for each event: (eventType, data) => void
   * @returns {Promise<void>}
   */
  async sendMessageStream(conversationId, content, quotedItems = [], fileData = [], onEvent) {
    // Get config from localStorage
    const apiKey = localStorage.getItem('openrouterApiKey') || '';
    const selectedModels = JSON.parse(localStorage.getItem('selectedModels') || '[]');
    const chairmanModel = localStorage.getItem('chairmanModel') || '';
    
    console.log('DEBUG API: sendMessageStream called with fileData:', fileData);
    
    const body = {
      content,
      quoted_items: quotedItems,
      files: fileData,
      api_key: apiKey,
      council_models: selectedModels,
      chairman_model: chairmanModel
    };
    
    console.log('DEBUG API: 发送到后端的完整请求体:', body);
    
    const response = await fetch(
      `${API_BASE}/api/conversations/${conversationId}/message/stream`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      }
    );

    if (!response.ok) {
      throw new Error('Failed to send message');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value);
      const lines = chunk.split('\n');

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          try {
            const event = JSON.parse(data);
            onEvent(event.type, event);
          } catch (e) {
            console.error('Failed to parse SSE event:', e);
          }
        }
      }
    }
  },

  /**
   * Delete a conversation.
   * @param {string} conversationId - The conversation ID to delete
   * @returns {Promise<Object>} Response from the API
   */
  async deleteConversation(conversationId) {
    const response = await fetch(`${API_BASE}/api/conversations/${conversationId}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    if (!response.ok) {
      throw new Error('Failed to delete conversation');
    }
    
    return response.json();
  },

  /**
   * Update a conversation title.
   * @param {string} conversationId - The conversation ID to update
   * @param {string} title - The new title for the conversation
   * @returns {Promise<Object>} Response from the API
   */
  async updateConversationTitle(conversationId, title) {
    const response = await fetch(`${API_BASE}/api/conversations/${conversationId}/title`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ title }),
    });
    
    if (!response.ok) {
      throw new Error('Failed to update conversation title');
    }
    
    return response.json();
  },

  /**
   * Regenerate stage3 result for a specific message.
   * @param {string} conversationId - The conversation ID
   * @param {number} messageIndex - The index of the message to regenerate stage3 for
   * @returns {Promise<Object>} Response from the API
   */
  async regenerateStage3(conversationId, messageIndex) {
    const apiKey = localStorage.getItem('openrouterApiKey') || '';
    const chairmanModel = localStorage.getItem('chairmanModel') || '';
    
    const response = await fetch(`${API_BASE}/api/conversations/${conversationId}/messages/${messageIndex}/regenerate-stage3`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ 
        api_key: apiKey,
        chairman_model: chairmanModel
      }),
    });
    
    if (!response.ok) {
      throw new Error('Failed to regenerate stage3');
    }
    
    return response.json();
  },
};
