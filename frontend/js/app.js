// frontend/js/app.js

// State variables
let currentConversationId = null;
let currentAbortController = null;
let userIsScrolledUp = false;

// Global chat session options set via slash commands
const sessionConfig = {
    systemPrompt: null,
    historyEnabled: true,
    wordWrap: true,
    jsonFormat: false,
    verbose: false,
    think: false,
    activeDocument: null
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

// Configure Marked to use Highlight.js and inject a Copy button into code snippets
const renderer = new marked.Renderer();
renderer.code = function(codeArg, langArg) {
    let code = '';
    let lang = '';

    // Handle Marked v12+ token object signature vs legacy string args
    if (typeof codeArg === 'object' && codeArg !== null) {
        code = codeArg.text || '';
        lang = codeArg.lang || '';
    } else {
        code = String(codeArg || '');
        lang = String(langArg || '');
    }

    const language = (lang && hljs.getLanguage(lang)) ? lang : 'plaintext';
    let highlighted = '';

    try {
        highlighted = hljs.highlight(code, { language }).value;
    } catch (e) {
        highlighted = code
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
    }

    // Escape code for data attribute inside button
    const safeCode = code
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');

    return `
        <div class="code-block-wrapper" style="position: relative; margin: 12px 0; border-radius: 6px; overflow: hidden; background: #16181d; border: 1px solid var(--border-color, #2d333f);">
            <div class="code-block-header" style="display: flex; justify-content: space-between; align-items: center; background: #21232b; padding: 6px 12px; font-size: 11px; color: #94a3b8; font-family: monospace;">
                <span>${language}</span>
                <button class="copy-code-btn" onclick="copyCodeSnippet(this)" data-code="${safeCode}" style="background: transparent; border: 1px solid #334155; color: #e2e8f0; font-size: 11px; padding: 2px 8px; border-radius: 4px; cursor: pointer; transition: all 0.2s;">
                    📋 Copy
                </button>
            </div>
            <pre style="margin: 0; padding: 12px; overflow-x: auto;"><code class="hljs language-${language}">${highlighted}</code></pre>
        </div>
    `;
};

marked.setOptions({
    renderer: renderer,
    breaks: true
});

// Global copy helper for code snippet buttons
window.copyCodeSnippet = function(button) {
    const rawCode = button.getAttribute('data-code');

    navigator.clipboard.writeText(rawCode).then(() => {
        const originalText = button.innerHTML;
        button.innerHTML = '✅ Copied!';
        button.style.borderColor = '#10b981';
        button.style.color = '#10b981';

        setTimeout(() => {
            button.innerHTML = originalText;
            button.style.borderColor = '#334155';
            button.style.color = '#e2e8f0';
        }, 2000);
    }).catch(err => {
        console.error('Failed to copy code: ', err);
    });
};

// DOM Elements
const chatMessagesDiv = document.getElementById('chatMessages');
const messageInput = document.getElementById('messageInput');
const sendBtn = document.getElementById('sendBtn');
const stopBtn = document.getElementById('stopBtn');
const newChatBtn = document.getElementById('newChatBtn');
const conversationsListDiv = document.getElementById('conversationsList');
const modelSelector = document.getElementById('modelSelector');
const commandMenu = document.getElementById('commandMenu');
const attachBtn = document.getElementById('attachBtn');
const pdfFileInput = document.getElementById('pdfFileInput');
const removeDocBtn = document.getElementById('removeDocBtn');

// Initialize app on DOM ready
document.addEventListener('DOMContentLoaded', () => {
    loadModels();
    loadConversations();
});

// PDF Attachment Event Handlers
if (attachBtn && pdfFileInput) {
    attachBtn.addEventListener('click', () => pdfFileInput.click());

    pdfFileInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        try {
            const data = await api.uploadPDF(file);

            sessionConfig.activeDocument = {
                filename: data.filename,
                text: data.extracted_text
            };

            const docPillName = document.getElementById('docPillName');
            const attachedDocPill = document.getElementById('attachedDocPill');

            if (docPillName) docPillName.textContent = `📄 ${data.filename}`;
            if (attachedDocPill) attachedDocPill.style.display = 'inline-flex';

            pdfFileInput.value = '';
        } catch (error) {
            alert(`Failed to attach PDF: ${error.message}`);
        }
    });
}

if (removeDocBtn) {
    removeDocBtn.addEventListener('click', () => {
        sessionConfig.activeDocument = null;
        const attachedDocPill = document.getElementById('attachedDocPill');
        if (attachedDocPill) attachedDocPill.style.display = 'none';
    });
}

// Global Event Listeners
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
    // Send on Enter (without Shift), allow multi-line with Shift+Enter
    messageInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            hideCommandMenu();
            sendMessage();
        }
    });

    // Auto-expand textarea height as user types or pastes multi-line text
    messageInput.addEventListener('input', function () {
        this.style.height = 'auto'; // Reset calculation height
        this.style.height = Math.min(this.scrollHeight, 200) + 'px'; // Cap max height at 200px

        const val = this.value;
        if (val.startsWith('/')) {
            showCommandMenu(val);
        } else {
            hideCommandMenu();
        }
    });
}

// Track manual scrolling in the chat message stream
if (chatMessagesDiv) {
    chatMessagesDiv.addEventListener('scroll', () => {
        const distanceFromBottom =
            chatMessagesDiv.scrollHeight - chatMessagesDiv.scrollTop - chatMessagesDiv.clientHeight;

        // Pause auto-scrolling if user scrolls up more than 50px
        userIsScrolledUp = distanceFromBottom > 50;
    });
}

if (newChatBtn) newChatBtn.addEventListener('click', startNewChat);

document.addEventListener('click', (e) => {
    if (e.target !== messageInput && e.target !== commandMenu) {
        hideCommandMenu();
    }
});

// Helper to render <think> reasoning tags into collapsible UI blocks with input guards
function renderMarkdownWithReasoning(rawText) {
    if (rawText === null || rawText === undefined) return '';
    if (typeof rawText !== 'string') {
        rawText = String(rawText);
    }
    if (!rawText.trim()) return '';

    // If thinking is disabled via /set nothink, strip <think>...</think> blocks entirely
    if (!sessionConfig.think) {
        const strippedText = rawText.replace(/<think>[\s\S]*?(?:<\/think>|$)/gi, '').trim();
        return marked.parse(strippedText);
    }

    let processedText = rawText;
    const thinkRegex = /<think>([\s\S]*?)(?:<\/think>|$)/gi;

    if (thinkRegex.test(rawText)) {
        processedText = rawText.replace(thinkRegex, (match, thinkContent) => {
            const parsedThink = marked.parse(thinkContent.trim());
            return `
                <details class="think-block" open style="background: #1e293b; border-left: 3px solid #6366f1; padding: 8px 12px; margin-bottom: 12px; border-radius: 4px;">
                    <summary style="font-size: 12px; color: #818cf8; font-weight: 600; cursor: pointer; user-select: none;">
                        🧠 Thought Process
                    </summary>
                    <div class="think-content" style="font-size: 13px; color: #94a3b8; margin-top: 6px;">
                        ${parsedThink}
                    </div>
                </details>
            `;
        });

        const nonThinkText = rawText.replace(/<think>[\s\S]*?(?:<\/think>|$)/gi, '');
        return processedText.replace(
            nonThinkText,
            nonThinkText.trim() ? marked.parse(nonThinkText) : ''
        );
    }

    return marked.parse(rawText);
}

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

function toggleGeneratingState(isGenerating) {
    if (isGenerating) {
        if (sendBtn) sendBtn.style.display = 'none';
        if (stopBtn) stopBtn.style.display = 'flex';
    } else {
        if (sendBtn) sendBtn.style.display = 'flex';
        if (stopBtn) stopBtn.style.display = 'none';
    }
}

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

function displaySystemNotice(text) {
    const noticeDiv = document.createElement('div');
    noticeDiv.className = 'message system-notice';
    noticeDiv.style.cssText = 'color: #94a3b8; font-size: 12px; font-style: italic; margin: 8px 0; text-align: center;';
    noticeDiv.textContent = `⚙️ ${text}`;
    chatMessagesDiv.appendChild(noticeDiv);
    chatMessagesDiv.scrollTop = chatMessagesDiv.scrollHeight;
}

// Core API Actions
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

async function loadConversation(conversationId) {
    if (!conversationId) return;

    currentConversationId = conversationId;
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

async function sendMessage() {
    const rawMessage = messageInput.value.trim();
    if (!rawMessage) return;

    // Reset input box value and collapse height back to single line
    messageInput.value = '';
    messageInput.style.height = 'auto';

    if (rawMessage.startsWith('/')) {
        const isCommand = handleSlashCommand(rawMessage);
        if (isCommand) return;
    }

    const selectedModel = (modelSelector && modelSelector.value) ? modelSelector.value : 'gemma3-1b:latest';

    const attachedFile = sessionConfig.activeDocument ? sessionConfig.activeDocument.filename : null;
    displayMessage('user', rawMessage, attachedFile);

    let payloadMessage = rawMessage;
    if (sessionConfig.activeDocument) {
        payloadMessage = `Document Context (${sessionConfig.activeDocument.filename}):\n---\n${sessionConfig.activeDocument.text}\n---\n\nUser Question: ${rawMessage}`;

        sessionConfig.activeDocument = null;
        const docPill = document.getElementById('attachedDocPill');
        if (docPill) docPill.style.display = 'none';
    }

    const assistantMessageDiv = document.createElement('div');
    assistantMessageDiv.className = 'message assistant';
    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content';

    // Set initial loading state inside contentDiv before stream starts
    contentDiv.innerHTML = `
        <div class="typing-indicator" style="display: inline-flex; align-items: center; gap: 4px; padding: 6px 0; color: #94a3b8; font-size: 13px; font-style: italic;">
            Processing <span style="width: 5px; height: 5px; background: #6366f1; border-radius: 50%; display: inline-block; animation: pulse 1.4s infinite ease-in-out both -0.32s;"></span><span style="width: 5px; height: 5px; background: #6366f1; border-radius: 50%; display: inline-block; animation: pulse 1.4s infinite ease-in-out both -0.16s;"></span><span style="width: 5px; height: 5px; background: #6366f1; border-radius: 50%; display: inline-block; animation: pulse 1.4s infinite ease-in-out both;"></span>
        </div>
    `;

    assistantMessageDiv.appendChild(contentDiv);
    chatMessagesDiv.appendChild(assistantMessageDiv);

    // Initial auto-scroll to reveal new prompt and loading indicator
    userIsScrolledUp = false;
    chatMessagesDiv.scrollTop = chatMessagesDiv.scrollHeight;

    let fullText = '';
    let isFirstChunk = true;

    currentAbortController = new AbortController();
    toggleGeneratingState(true);

    try {
        const result = await api.streamMessage(
            sessionConfig.historyEnabled ? currentConversationId : null,
            payloadMessage,
            selectedModel,
            (chunk) => {
                // Clear loading indicator on first token
                if (isFirstChunk) {
                    contentDiv.innerHTML = '';
                    isFirstChunk = false;
                    userIsScrolledUp = false;
                }

                fullText += chunk;
                contentDiv.innerHTML = renderMarkdownWithReasoning(fullText);

                // Smart auto-scroll: only scroll down if user hasn't scrolled up manually
                if (!userIsScrolledUp) {
                    chatMessagesDiv.scrollTop = chatMessagesDiv.scrollHeight;
                }
            },
            currentAbortController.signal,
            sessionConfig
        );

        if (!currentConversationId && result.conversation_id) {
            currentConversationId = result.conversation_id;
        }

        await loadConversations();

    } catch (error) {
        if (error.name === 'AbortError') {
            contentDiv.innerHTML += ' <em>[Generation stopped]</em>';
        } else {
            contentDiv.innerHTML = `<em>Error: ${error.message}</em>`;
        }
    } finally {
        currentAbortController = null;
        toggleGeneratingState(false);
    }
}

// Render message bubble, automatically stripping document context leaks
function displayMessage(role, content, attachedFilename = null) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${role}`;

    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content';

    if (role === 'user') {
        let cleanText = content;
        let detectedFilename = attachedFilename;

        // Strip out Document Context wrapper if it leaked into the content string
        const docContextMatch = cleanText.match(/^Document Context \((.*?)\):\n---\n[\s\S]*?\n---\n\nUser Question:\s*/);
        if (docContextMatch) {
            if (!detectedFilename) {
                detectedFilename = docContextMatch[1]; // Extract filename from wrapper
            }
            cleanText = cleanText.replace(docContextMatch[0], ''); // Remove raw PDF dump
        }

        // Render file badge if a document was attached
        if (detectedFilename) {
            const attachmentBadge = document.createElement('div');
            attachmentBadge.className = 'user-attached-file';
            attachmentBadge.innerHTML = `
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 1 2-2V8z"></path>
                    <polyline points="14 2 14 8 20 8"></polyline>
                </svg>
                <span>${detectedFilename}</span>
            `;
            contentDiv.appendChild(attachmentBadge);
        }

        const textSpan = document.createElement('div');
        textSpan.textContent = cleanText;
        contentDiv.appendChild(textSpan);

    } else if (role === 'assistant') {
        contentDiv.innerHTML = renderMarkdownWithReasoning(content);
    }

    messageDiv.appendChild(contentDiv);
    chatMessagesDiv.appendChild(messageDiv);

    if (!userIsScrolledUp) {
        chatMessagesDiv.scrollTop = chatMessagesDiv.scrollHeight;
    }
}

function startNewChat() {
    currentConversationId = null;
    sessionConfig.activeDocument = null;
    chatMessagesDiv.innerHTML = '';
    messageInput.value = '';
    messageInput.style.height = 'auto';
    messageInput.focus();
    loadConversations();
}

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
