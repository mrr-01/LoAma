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

        if (Array.isArray(conversations) && conversations.length > 0) {
          conversations.forEach(conv => {
              const div = document.createElement('div');
              div.className = `conversation-item ${conv.id === currentConversationId ? 'active' : ''}`;

              // Title element
              const titleSpan = document.createElement('span');
              titleSpan.className = 'conversation-title';
              titleSpan.textContent = conv.title || 'New Conversation';
              div.appendChild(titleSpan);

              // Delete Button (Trash Icon)
              const deleteBtn = document.createElement('button');
              deleteBtn.className = 'delete-chat-btn';
              deleteBtn.title = 'Delete chat';
              deleteBtn.innerHTML = `
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <polyline points="3 6 5 6 21 6"></polyline>
                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                  </svg>
              `;

              // Handle delete click (e.stopPropagation prevents switching to conversation)
              deleteBtn.onclick = (e) => {
                  e.stopPropagation();
                  handleDeleteConversation(conv.id);
              };

              div.appendChild(deleteBtn);

              // Handle selecting conversation
              div.onclick = () => loadConversation(conv.id);

              conversationsListDiv.appendChild(div);
          });
      } else {
          conversationsListDiv.innerHTML = '<div class="history-label" style="text-transform:none;">No chats found</div>';
      }
  } catch (error) {
      console.error('Failed to load conversations:', error);
  }
  }

        // Handler to delete conversation from backend and reset state if needed
        async function handleDeleteConversation(conversationId) {
            if (!confirm('Are you sure you want to delete this chat?')) return;

            try {
                await api.deleteConversation(conversationId);

                // If deleted chat was currently open, reset the main view
                if (currentConversationId === conversationId) {
                    startNewChat();
                } else {
                    await loadConversations();
                }
            } catch (error) {
                console.error('Failed to delete conversation:', error);
                alert(`Could not delete conversation: ${error.message}`);
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
