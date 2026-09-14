const API_URL = 'http://localhost:8000/api';

class OllamaAPI {
    // 1. Fetch available Ollama models
    async getModels() {
        const response = await fetch(`${API_URL}/models`);
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.detail || 'Failed to fetch models');
        }
        return await response.json();
    }

    // 2. Send message to backend chat endpoint
    async sendMessage(conversationId, message, model = 'gemma3-1b:latest') {
        const response = await fetch(`${API_URL}/chat`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                conversation_id: conversationId,
                message: message,
                model: model
            }),
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.detail || 'Failed to send message');
        }

        return await response.json();
    }

    // 3. Get list of past conversations
    async getConversations() {
        const response = await fetch(`${API_URL}/conversations`);
        if (!response.ok) throw new Error('Failed to fetch conversations');
        return await response.json();
    }

    // 4. Get messages for a specific conversation
    async getMessages(conversationId) {
        const response = await fetch(`${API_URL}/conversations/${conversationId}/messages`);
        if (!response.ok) throw new Error('Failed to fetch messages');
        return await response.json();
    }

    // 5. Delete a conversation
    async deleteConversation(conversationId) {
        const response = await fetch(`${API_URL}/conversations/${conversationId}`, {
            method: 'DELETE'
        });
        if (!response.ok) throw new Error('Failed to delete conversation');
        return await response.json();
    }
}

// Instantiate API globally
const api = new OllamaAPI();
