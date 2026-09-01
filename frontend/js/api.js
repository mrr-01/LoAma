const API_URL = 'http://localhost:8000/api';

class OllamaAPI {
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

    async getConversations() {
        const response = await fetch(`${API_URL}/conversations`);
        if (!response.ok) throw new Error('Failed to fetch conversations');
        return await response.json();
    }

    async getMessages(conversationId) {
        const response = await fetch(`${API_URL}/conversations/${conversationId}`);
        if (!response.ok) throw new Error('Failed to fetch messages');
        return await response.json();
    }

    async deleteConversation(conversationId) {
        const response = await fetch(`${API_URL}/conversations/${conversationId}`, {
            method: 'DELETE'
        });
        if (!response.ok) throw new Error('Failed to delete conversation');
        return await response.json();
    }
}

const api = new OllamaAPI();
