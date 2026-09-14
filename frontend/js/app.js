// frontend/js/app.js

// State variables
let currentConversationId = null;
let currentAbortController = null;

// Global chat session options set via slash commands
const sessionConfig = {
    systemPrompt: null,
    historyEnabled: true,
    wordWrap: true,
    jsonFormat: false,
    verbose: false,
    think: false
};

// Available slash commands definition
const AVAILABLE_COMMANDS = [
    { cmd: '/set system', desc: 'Set system message prompt' },
    { cmd: '/set history', desc: 'Enable conversation history' },
    { cmd: '/set nohistory', desc: 'Disable conversation history' },
    { cmd: '/set wordwrap', desc: 'Enable line word wrapping' },
    { cmd: '/set nowordwrap', desc: 'Disable line word wrapping' },
    { cmd: '/set format json', desc: 'Force output in JSON format' },
    { cmd: '/set noformat', desc: 'Disable JSON mode' },
    { cmd: '/set verbose', desc: 'Display execution time & stats' },
    { cmd: '/set quiet', desc: 'Hide execution stats' },
    { cmd: '/set think', desc: 'Enable model reasoning process' },
    { cmd: '/set nothink', desc: 'Disable model reasoning process' }
];

// Configure Marked to use Highlight.js for code snippets
marked.setOptions({
    highlight: function(code, lang) {
        const language = hljs.getLanguage(lang) ? lang : 'plaintext';
        return hljs.highlight(code, { language }).value;
    },
    breaks: true
});

// DOM Elements
const chatMessagesDiv = document.getElementById('chatMessages');
const messageInput = document.getElementById('messageInput');
const sendBtn = document.getElementById('sendBtn');
const stopBtn = document.getElementById('stopBtn');
const newChatBtn = document.getElementById('newChatBtn');
const conversationsListDiv = document.getElementById('conversationsList');
const modelSelector = document.getElementById('modelSelector');
const commandMenu = document.getElementById('commandMenu');

// Initialize app on DOM ready
document.addEventListener('DOMContentLoaded', () => {
    loadModels();
    loadConversations();
});

// Event listeners
if (sendBtn) sendBtn.addEventListener('click', sendMessage);

if (stopBtn) {
    stopBtn.addEventListener('click', () => {
        if (currentAbortController) {
            currentAbortController.abort();
            currentAbortController = null;
        }
    });
}

if (messageInput) {
    // Listen for Enter key to submit
    messageInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            hideCommandMenu();
            sendMessage();
        }
    });

    // Listen for real-time typing to trigger slash menu
    messageInput.addEventListener('input', (e) => {
        const val = e.target.value;
        if (val.startsWith('/')) {
            showCommandMenu(val);
        } else {
            hideCommandMenu();
        }
    });
}

if (newChatBtn) newChatBtn.addEventListener('click', startNewChat);

// Close slash menu on outside click
document.addEventListener('click', (e) => {
    if (e.target !== messageInput && e.target !== commandMenu) {
        hideCommandMenu();
    }
});

// Show autocomplete slash menu
function showCommandMenu(filterText) {
    if (!commandMenu) return;

    const query = filterText.toLowerCase();
    const filtered = AVAILABLE_COMMANDS.filter(item => item.cmd.toLowerCase().startsWith(query));

    if (filtered.length === 0) {
        hideCommandMenu();
        return;
    }

    commandMenu.innerHTML = '';
    filtered.forEach(item => {
        const div = document.createElement('div');
        div.className = 'command-item';
        div.style.cssText = 'padding: 8px 12px; display: flex; justify-content: space-between; cursor: pointer; font-size: 13px; color: #e2e8f0; border-bottom: 1px solid #2d333f;';
        div.innerHTML = `<strong>${item.cmd}</strong> <span style="font-size: 11px; color: #94a3b8;">${item.desc}</span>`;
        div.onclick = () => {
            messageInput.value = item.cmd + ' ';
            messageInput.focus();
            hideCommandMenu();
        };
        commandMenu.appendChild(div);
    });

    commandMenu.style.display = 'block';
}

function hideCommandMenu() {
    if (commandMenu) commandMenu.style.display = 'none';
}

// Toggle UI state between Send and Stop
function toggleGeneratingState(isGenerating) {
    if (isGenerating) {
        if (sendBtn) sendBtn.style.display = 'none';
        if (stopBtn) stopBtn.style.display = 'flex';
    } else {
        if (sendBtn) sendBtn.style.display = 'flex';
        if (stopBtn) stopBtn.style.display = 'none';
    }
}

// Parse and execute slash commands
function handleSlashCommand(input) {
    const parts = input.trim().split(' ');
    const mainCmd = parts[0].toLowerCase();
    const subCmd = parts[1] ? parts[1].toLowerCase() : '';
    const args = parts.slice(2).join(' ');

    if (mainCmd !== '/set') return false;

    let responseMsg = '';

    switch (subCmd) {
        case 'system':
            sessionConfig.systemPrompt = args || null;
            responseMsg = args ? `System message updated: "${args}"` : 'System message cleared.';
            break;

        case 'history':
            sessionConfig.historyEnabled = true;
            responseMsg = 'Conversation history enabled.';
            break;

        case 'nohistory':
            sessionConfig.historyEnabled = false;
            responseMsg = 'Conversation history disabled for upcoming prompts.';
            break;

        case 'wordwrap':
            sessionConfig.wordWrap = true;
            chatMessagesDiv.style.whiteSpace = 'pre-wrap';
            responseMsg = 'Wordwrap enabled.';
            break;

        case 'nowordwrap':
            sessionConfig.wordWrap = false;
            chatMessagesDiv.style.whiteSpace = 'pre';
            responseMsg = 'Wordwrap disabled.';
            break;

        case 'format':
            if (args.toLowerCase() === 'json') {
                sessionConfig.jsonFormat = true;
                responseMsg = 'JSON output format enabled.';
            } else {
                responseMsg = 'Unsupported format. Use `/set format json`.';
            }
            break;

        case 'noformat':
            sessionConfig.jsonFormat = false;
            responseMsg = 'Formatting constraints disabled.';
            break;

        case 'verbose':
            sessionConfig.verbose = true;
            responseMsg = 'Verbose stats enabled.';
            break;

        case 'quiet':
            sessionConfig.verbose = false;
            responseMsg = 'Verbose stats disabled.';
            break;

        case 'think':
            sessionConfig.think = true;
            responseMsg = 'Model thinking enabled.';
            break;

        case 'nothink':
            sessionConfig.think = false;
            responseMsg = 'Model thinking disabled.';
            break;

        default:
            responseMsg = `Unknown command: ${input}. Available commands: /set system, /set history, /set nohistory, /set wordwrap, /set nowordwrap, /set format json, /set noformat, /set verbose, /set quiet, /set think, /set nothink.`;
            break;
    }

    displaySystemNotice(responseMsg);
    return true;
}

// Display inline system notice bubbles
function displaySystemNotice(text) {
    const noticeDiv = document.createElement('div');
    noticeDiv.className = 'message system-notice';
    noticeDiv.style.cssText = 'color: #94a3b8; font-size: 12px; font-style: italic; margin: 8px 0; text-align: center;';
    noticeDiv.textContent = `⚙️ ${text}`;
    chatMessagesDiv.appendChild(noticeDiv);
    chatMessagesDiv.scrollTop = chatMessagesDiv.scrollHeight;
}

// 1. Fetch all conversations from backend SQLite database
async function loadConversations() {
    try {
        const conversations = await api.getConversations();
        conversationsListDiv.innerHTML = '';

        if (Array.isArray(conversations) && conversations.length > 0) {
            conversations.forEach(conv => {
                const div = document.createElement('div');
                div.className = `conversation-item ${conv.id === currentConversationId ? 'active' : ''}`;

                const titleSpan = document.createElement('span');
                titleSpan.className = 'conversation-title';
                titleSpan.textContent = conv.title || 'New Conversation';
                div.appendChild(titleSpan);

                const deleteBtn = document.createElement('button');
                deleteBtn.className = 'delete-chat-btn';
                deleteBtn.title = 'Delete chat';
                deleteBtn.innerHTML = `
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="3 6 5 6 21 6"></polyline>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                    </svg>
                `;

                deleteBtn.onclick = (e) => {
                    e.stopPropagation();
                    handleDeleteConversation(conv.id);
                };

                div.appendChild(deleteBtn);
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

// Handler to delete conversation
async function handleDeleteConversation(conversationId) {
    if (!confirm('Are you sure you want to delete this chat?')) return;

    try {
        await api.deleteConversation(conversationId);
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

// 2. Load selected conversation message history
// frontend/js/app.js

async function loadConversation(conversationId) {
    if (!conversationId) return;

    // Set active ID FIRST so sidebar highlighting works correctly
    currentConversationId = conversationId;

    // Re-render sidebar to update the active item styling
    await loadConversations();

    try {
        const data = await api.getMessages(conversationId);
        chatMessagesDiv.innerHTML = '';

        if (data.messages) {
            data.messages.forEach(msg => {
                displayMessage(msg.role, msg.content);
            });
        }

        if (data.model_used && modelSelector) {
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

// 3. Send message with command parsing and stream handlin
async function sendMessage() {
    const message = messageInput.value.trim();
    if (!message) return;

    messageInput.value = '';

    if (message.startsWith('/')) {
        const isCommand = handleSlashCommand(message);
        if (isCommand) return;
    }

    const selectedModel = (modelSelector && modelSelector.value) ? modelSelector.value : 'gemma3-1b:latest';

    displayMessage('user', message);

    const assistantMessageDiv = document.createElement('div');
    assistantMessageDiv.className = 'message assistant';

    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content';
    assistantMessageDiv.appendChild(contentDiv);
    chatMessagesDiv.appendChild(assistantMessageDiv);

    let fullText = '';
    const startTime = Date.now();

    currentAbortController = new AbortController();
    toggleGeneratingState(true);

    try {
        // Force passing active currentConversationId to backend
        const result = await api.streamMessage(
            sessionConfig.historyEnabled ? currentConversationId : null,
            message,
            selectedModel,
            (chunk) => {
                fullText += chunk;
                contentDiv.innerHTML = marked.parse(fullText);
                chatMessagesDiv.scrollTop = chatMessagesDiv.scrollHeight;
            },
            currentAbortController.signal,
            sessionConfig
        );

        if (sessionConfig.verbose) {
            const duration = ((Date.now() - startTime) / 1000).toFixed(2);
            const statsDiv = document.createElement('div');
            statsDiv.style.cssText = 'font-size: 11px; color: #64748b; margin-top: 6px; font-family: monospace;';
            statsDiv.textContent = `⏱️ Generated in ${duration}s | Model: ${selectedModel} | History: ${sessionConfig.historyEnabled ? 'ON' : 'OFF'}`;
            contentDiv.appendChild(statsDiv);
        }

        // --- FIX: Only set ID if this was a new conversation ---
        if (!currentConversationId && result.conversation_id) {
            currentConversationId = result.conversation_id;
        }

        // Refresh sidebar titles without clearing currentConversationId
        await loadConversations();

    } catch (error) {
        if (error.name === 'AbortError') {
            contentDiv.innerHTML += ' <em>[Generation stopped]</em>';
        } else {
            contentDiv.innerHTML = `<em>Error: ${error.message}</em>`;
            console.error('Streaming error:', error);
        }
    } finally {
        currentAbortController = null;
        toggleGeneratingState(false);
    }
}

// 4. Render message with Markdown parsing
function displayMessage(role, content) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${role}`;

    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content';

    if (role === 'assistant') {
        contentDiv.innerHTML = marked.parse(content);
    } else {
        contentDiv.textContent = content;
    }

    messageDiv.appendChild(contentDiv);
    chatMessagesDiv.appendChild(messageDiv);
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
            modelSelector.innerHTML = '';

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
