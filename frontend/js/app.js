// frontend/js/app.js

let currentConversationId = null;

const chatMessagesDiv = document.getElementById('chatMessages');
const messageInput = document.getElementById('messageInput');
const sendBtn = document.getElementById('sendBtn');
const newChatBtn = document.getElementById('newChatBtn');
const conversationsListDiv = document.getElementById('conversationsList');

// Load conversations on startup
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

async function loadConversations() {
    try {
        const conversations = await api.getConversations();
        conversationsListDiv.innerHTML = '';

        conversations.forEach(conv => {
            const div = document.createElement('div');
            div.className = 'conversation-item';
            div.textContent = conv.title;
            div.onclick = () => loadConversation(conv.id);
            conversationsListDiv.appendChild(div);
        });
    } catch (error) {
        console.error('Failed to load conversations:', error);
    }
}

async function loadConversation(conversationId) {
    currentConversationId = conversationId;

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

async function sendMessage() {
    const message = messageInput.value.trim();
    if (!message) return;

    messageInput.value = '';

    // Display user message immediately
    displayMessage('user', message);

    // Show loading indicator
    const loadingDiv = document.createElement('div');
    loadingDiv.className = 'loading';
    loadingDiv.textContent = 'Thinking...';
    chatMessagesDiv.appendChild(loadingDiv);

    try {
      const response = await api.sendMessage(currentConversationId, message, 'gemma3-1b:latest');
        // Remove loading indicator
        loadingDiv.remove();

        // Update conversation ID if new
        if (!currentConversationId) {
            currentConversationId = response.conversation_id;
        }

        // Display assistant response
        displayMessage('assistant', response.assistant_message.content);

        // Refresh conversation list
        loadConversations();

    } catch (error) {
        loadingDiv.textContent = `Error: ${error.message}`;
        console.error('Failed to send message:', error);
    }
}

function displayMessage(role, content) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${role}`;

    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content';
    contentDiv.textContent = content;

    messageDiv.appendChild(contentDiv);
    chatMessagesDiv.appendChild(messageDiv);

    // Scroll to bottom
    chatMessagesDiv.scrollTop = chatMessagesDiv.scrollHeight;
}

function startNewChat() {
    currentConversationId = null;
    chatMessagesDiv.innerHTML = '';
    messageInput.value = '';
    messageInput.focus();
}
