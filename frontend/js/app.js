// frontend/js/app.js

// Configure Marked to use Highlight.js for code snippets
marked.setOptions({
    highlight: function(code, lang) {
        const language = hljs.getLanguage(lang) ? lang : 'plaintext';
        return hljs.highlight(code, { language }).value;
    },
    breaks: true
});

let currentConversationId = null;

// DOM Elements
const chatMessagesDiv = document.getElementById('chatMessages');
const messageInput = document.getElementById('messageInput');
const sendBtn = document.getElementById('sendBtn');
const newChatBtn = document.getElementById('newChatBtn');
const conversationsListDiv = document.getElementById('conversationsList');
const modelSelector = document.getElementById('modelSelector'); // Added missing element reference

// Initialize app on DOM ready
document.addEventListener('DOMContentLoaded', () => {
    loadModels();
    loadConversations();
});

// Event listeners
if (sendBtn) sendBtn.addEventListener('click', sendMessage);
if (messageInput) {
    messageInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });
}
if (newChatBtn) newChatBtn.addEventListener('click', startNewChat);

// 1. Fetch all conversations from backend SQLite database
async function loadConversations() {
    try {
        const conversations = await api.getConversations();
        conversationsListDiv.innerHTML = '';

        conversations.forEach(conv => {
            const div = document.createElement('div');
            div.className = `conversation-item ${conv.id === currentConversationId ? 'active' : ''}`;
            div.textContent = conv.title || 'New Conversation';
            div.onclick = () => loadConversation(conv.id);
            conversationsListDiv.appendChild(div);
        });
    } catch (error) {
        console.error('Failed to load conversations:', error);
    }
}


// 2. Load selected conversation message history & update header model dropdown
async function loadConversation(conversationId) {
    currentConversationId = conversationId;
    loadConversations(); // Update active highlight state in sidebar

    try {
        const data = await api.getMessages(conversationId);
        chatMessagesDiv.innerHTML = '';

        // 1. Render messages
        if (data.messages) {
            data.messages.forEach(msg => {
                displayMessage(msg.role, msg.content);
            });
        }

        // 2. Sync header dropdown to conversation's stored model_used
        if (data.model_used && modelSelector) {
            // Check if option exists in dropdown, add it if missing
            let optionExists = Array.from(modelSelector.options).some(opt => opt.value === data.model_used);
            if (!optionExists) {
                const opt = document.createElement('option');
                opt.value = data.model_used;
                opt.textContent = data.model_used;
                modelSelector.appendChild(opt);
            }
            modelSelector.value = data.model_used;
        }

    } catch (error) {
        console.error('Failed to load conversation:', error);
    }
}
// 3. Send message to backend API
async function sendMessage() {
    const message = messageInput.value.trim();
    if (!message) return;

    // Safely get selected model with fallback
    const selectedModel = (modelSelector && modelSelector.value) ? modelSelector.value : 'gemma3-1b:latest';

    messageInput.value = '';

    // Display user message immediately
    displayMessage('user', message);

    // Show loading indicator
    const loadingDiv = document.createElement('div');
    loadingDiv.className = 'loading message assistant';
    loadingDiv.innerHTML = '<div class="message-content">Thinking...</div>';
    chatMessagesDiv.appendChild(loadingDiv);
    chatMessagesDiv.scrollTop = chatMessagesDiv.scrollHeight;

    try {
        // Pass selected model to API call
        const response = await api.sendMessage(currentConversationId, message, selectedModel);

        // Remove loading indicator
        loadingDiv.remove();

        // Update active conversation ID if it was a new chat
        if (!currentConversationId) {
            currentConversationId = response.conversation_id;
        }

        // Display formatted assistant response
        displayMessage('assistant', response.assistant_message.content);

        // Refresh sidebar so title updates from database
        await loadConversations();

    } catch (error) {
        loadingDiv.remove();
        displayMessage('assistant', `**Error sending message:** ${error.message}`);
        console.error('Failed to send message:', error);
    }
}

// 4. Render message with Markdown parsing
function displayMessage(role, content) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${role}`;

    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content';

    if (role === 'assistant') {
        // Parse raw Markdown into formatted HTML
        contentDiv.innerHTML = marked.parse(content);
    } else {
        // Keep user text safe from XSS injection
        contentDiv.textContent = content;
    }

    messageDiv.appendChild(contentDiv);
    chatMessagesDiv.appendChild(messageDiv);

    // Scroll to bottom
    chatMessagesDiv.scrollTop = chatMessagesDiv.scrollHeight;
}

// 5. Reset UI for a fresh chat session
function startNewChat() {
    currentConversationId = null;
    chatMessagesDiv.innerHTML = '';
    messageInput.value = '';
    messageInput.focus();
    loadConversations();
}

// 6. Load available Ollama Models into dropdown
async function loadModels() {
    if (!modelSelector) return;

    try {
        const data = await api.getModels();

        if (data && data.models && data.models.length > 0) {
            modelSelector.innerHTML = ''; // Clear default options

            data.models.forEach(modelName => {
                const option = document.createElement('option');
                option.value = modelName;
                option.textContent = modelName;
                modelSelector.appendChild(option);
            });

            console.log(`Successfully loaded ${data.models.length} models from Ollama.`);
        } else {
            console.warn('No models returned from Ollama backend.');
        }
    } catch (error) {
        console.error('Could not load models:', error);
    }
}
