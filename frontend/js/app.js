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

const chatMessagesDiv = document.getElementById('chatMessages');
const messageInput = document.getElementById('messageInput');
const sendBtn = document.getElementById('sendBtn');
const newChatBtn = document.getElementById('newChatBtn');
const conversationsListDiv = document.getElementById('conversationsList');

// Initialize conversations on application startup
loadConversations();

// Event listeners
sendBtn.addEventListener('click', sendMessage);
messageInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
    }
});
newChatBtn.addEventListener('click', startNewChat);

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

// 2. Load selected conversation message history
async function loadConversation(conversationId) {
    currentConversationId = conversationId;
    loadConversations(); // Update active highlight state in sidebar

    try {
        const data = await api.getMessages(conversationId);
        chatMessagesDiv.innerHTML = '';

        data.messages.forEach(msg => {
            displayMessage(msg.role, msg.content);
        });
    } catch (error) {
        console.error('Failed to load conversation:', error);
    }
}

// 3. Send message to backend API
async function sendMessage() {
    const message = messageInput.value.trim();
    if (!message) return;

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
        const response = await api.sendMessage(currentConversationId, message, 'gemma3-1b:latest');

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
        loadingDiv.innerHTML = `<div class="message-content">Error: ${error.message}</div>`;
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
