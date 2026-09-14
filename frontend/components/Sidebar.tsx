// frontend/components/Sidebar.tsx
import React from 'react';

export interface ConversationItem {
  id: string;
  title: string;
}

interface SidebarProps {
  conversations: ConversationItem[];
  activeId: string | null;
  onSelectConversation: (id: string) => void;
  onNewChat: () => void;
}

export function Sidebar({
  conversations,
  activeId,
  onSelectConversation,
  onNewChat,
}: SidebarProps) {
  return (
    <aside className="w-64 h-full bg-slate-950 border-r border-slate-800/80 hidden md:flex flex-col justify-between p-4">
      <div className="space-y-6 overflow-hidden flex flex-col h-full">
        {/* Brand */}
        <div className="flex items-center space-x-3 px-2 flex-shrink-0">
          <div className="w-8 h-8 rounded-xl bg-blue-600 flex items-center justify-center font-bold text-white shadow-lg shadow-blue-500/20">
            L
          </div>
          <span className="font-semibold tracking-wide text-slate-100 text-base">LoAMA</span>
        </div>

        {/* Action Button */}
        <button
          onClick={onNewChat}
          className="w-full py-2.5 px-4 bg-slate-900 hover:bg-slate-800/80 text-slate-200 border border-slate-800 rounded-xl flex items-center space-x-2 text-sm font-medium transition-all flex-shrink-0"
        >
          <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
          </svg>
          <span>New Chat</span>
        </button>

        {/* Dynamic History Navigation */}
        <div className="flex-1 overflow-y-auto space-y-1 pr-1 scrollbar-thin scrollbar-thumb-slate-800">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider px-2">Recent</span>
          {conversations.length === 0 ? (
            <p className="text-xs text-slate-600 px-2 py-1">No chats yet</p>
          ) : (
            conversations.map((conv) => (
              <button
                key={conv.id}
                onClick={() => onSelectConversation(conv.id)}
                className={`w-full text-left py-2 px-3 rounded-lg text-xs font-medium transition-colors truncate block ${
                  conv.id === activeId
                    ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30'
                    : 'text-slate-300 hover:bg-slate-900/80'
                }`}
              >
                {conv.title || 'Untitled Chat'}
              </button>
            ))
          )}
        </div>
      </div>

      {/* Footer Profile Info */}
      <div className="pt-4 border-t border-slate-800/60 flex items-center space-x-3 px-2 flex-shrink-0">
        <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-xs font-semibold text-slate-300">
          VJ
        </div>
        <div className="flex flex-col truncate">
          <span className="text-xs font-medium text-slate-200 truncate">Victor Joseph</span>
          <span className="text-[10px] text-slate-500 truncate">Local Instance</span>
        </div>
      </div>
    </aside>
  );
}
