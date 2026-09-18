// frontend/js/api.js

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

    // 2. Non-streaming message fallback
    async sendMessage(conversationId, message, model = 'gemma3-1b:latest') {
        const response = await fetch(`${API_URL}/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
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

    // 3. Stream message tokens directly from Ollama
    async streamMessage(conversationId, message, model, onChunk, signal = null, config = {}) {
        const payload = {
            conversation_id: conversationId,
            message: message,
            model: model,
            system_prompt: config.systemPrompt || null,
            format_json: config.jsonFormat || false,
            think: config.think || false
        };

        const response = await fetch(`${API_URL}/chat/stream`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
            signal: signal
        });

        if (!response.ok) throw new Error('Streaming request failed');

        const newConvId = response.headers.get('X-Conversation-Id');
        const reader = response.body.getReader();
        const decoder = new TextDecoder();

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            const chunk = decoder.decode(value, { stream: true });
            onChunk(chunk);
        }

        return { conversation_id: newConvId };
    }

    // 4. Get list of past conversations
    async getConversations() {
        const response = await fetch(`${API_URL}/conversations`);
        if (!response.ok) throw new Error('Failed to fetch conversations');
        return await response.json();
    }

    // 5. Get messages for a specific conversation
    async getMessages(conversationId) {
        const response = await fetch(`${API_URL}/conversations/${conversationId}`);
        if (!response.ok) throw new Error('Failed to fetch messages');
        return await response.json();
    }

    // 6. Delete a conversation
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
