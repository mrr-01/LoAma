// frontend/components/Chat.tsx
import React, { useState, useEffect } from 'react';
import { Sidebar, ConversationItem } from './Sidebar';
import { MessageList } from './MessageList';
import { ChatInput } from './ChatInput';

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

export function Chat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // 1. Fetch conversation history on mount
  const fetchConversations = async () => {
    try {
      const res = await fetch('/api/conversations');
      if (res.ok) {
        const data = await res.json();
        setConversations(data);
      }
    } catch (err) {
      console.error('Failed to load conversations:', err);
    }
  };

  useEffect(() => {
    fetchConversations();
  }, []);

  // 2. Fetch messages for selected conversation
  const handleSelectConversation = async (id: string) => {
    setActiveConversationId(id);
    try {
      const res = await fetch(`/api/conversations/${id}/messages`);
      if (res.ok) {
        const data = await res.json();
        const formatted: Message[] = data.map((msg: any) => ({
          id: msg.id.toString(),
          role: msg.role,
          content: msg.content,
          timestamp: new Date(msg.created_at || Date.now()).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          }),
        }));
        setMessages(formatted);
      }
    } catch (err) {
      console.error('Failed to load conversation messages:', err);
    }
  };

  // 3. Start a fresh conversation
  const handleNewChat = () => {
    setActiveConversationId(null);
    setMessages([]);
  };

  // 4. Send message to active conversation
  const handleSend = async (content: string) => {
    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setIsLoading(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: content,
          conversation_id: activeConversationId,
        }),
      });

      const data = await response.json();

      if (!activeConversationId && data.conversation_id) {
        setActiveConversationId(data.conversation_id);
      }

      const assistantMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.assistant_message.content,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setMessages((prev) => [...prev, assistantMsg]);
      fetchConversations(); // Sync sidebar titles
    } catch (err) {
      console.error('Failed to send message:', err);
    } font-sans finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex h-screen bg-slate-950 text-slate-100 font-sans antialiased overflow-hidden">
      <Sidebar
        conversations={conversations}
        activeId={activeConversationId}
        onSelectConversation={handleSelectConversation}
        onNewChat={handleNewChat}
      />

      <main className="flex-1 flex flex-col h-full bg-slate-900/50 backdrop-blur-md relative">
        <header className="h-16 border-b border-slate-800/60 px-6 flex items-center justify-between bg-slate-900/80">
          <div className="flex items-center space-x-3">
            <div className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse" />
            <h1 className="text-sm font-semibold tracking-wide text-slate-200">
              LoAMA Assistant
            </h1>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto px-4 py-6 md:px-12 lg:px-24 scrollbar-thin scrollbar-thumb-slate-800">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center text-slate-500 space-y-3">
              <div className="p-4 rounded-2xl bg-slate-800/40 border border-slate-800">
                <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                </svg>
              </div>
              <p className="text-lg font-medium text-slate-300">How can I help you today?</p>
              <p className="text-xs text-slate-500 max-w-sm">
                Type your request below to start a new chat session.
              </p>
            </div>
          ) : (
            <MessageList messages={messages} isLoading={isLoading} />
          )}
        </div>

        <div className="p-4 md:px-12 lg:px-24 bg-gradient-to-t from-slate-950 via-slate-950/80 to-transparent">
          <ChatInput onSend={handleSend} disabled={isLoading} />
        </div>
      </main>
    </div>
  );
}
