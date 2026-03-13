
import React, { useEffect, useRef, useState } from 'react';
import { Message, AppConfig } from '../types';
import MarkdownRenderer from './MarkdownRenderer';

interface MessageListProps {
  messages: Message[];
  isLoading: boolean;
  onSvgClick: (svgContent: string) => void;
  onArchive: (text: string) => void;
  onBranch: (messageId: string, specificText?: string) => void;
  config: AppConfig;
}

const MessageList: React.FC<MessageListProps> = ({ messages, isLoading, onSvgClick, onArchive, onBranch, config }) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [archivedIds, setArchivedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleArchiveClick = (id: string, text: string, variant?: string) => {
    onArchive(text);
    // Track unique archive action by ID + variant (if comparison)
    setArchivedIds(prev => new Set(prev).add(variant ? `${id}_${variant}` : id));
  };

  const isArchived = (id: string, variant?: string) => {
      return archivedIds.has(variant ? `${id}_${variant}` : id);
  };

  // Reusable Header Component for Actions
  const MessageHeader = ({ role, id, text, variant }: { role: string, id: string, text: string, variant?: string }) => (
    <div className="text-[10px] text-white/30 mb-1 tracking-wider uppercase flex items-center gap-2 justify-between">
      <span>{role === 'user' ? 'USER_01' : `SYSTEM_AI [${config.provider}]${variant ? ' // ' + variant : ''}`}</span>
      {role === 'model' && (
        <div className="flex gap-2 opacity-0 group-hover/msg:opacity-100 transition-opacity">
            <button 
              onClick={() => onBranch(id, text)}
              className="uppercase text-[9px] tracking-widest border border-white/10 px-2 py-0.5 hover:bg-white hover:text-black text-white/40 flex items-center gap-1"
              title="Fork Conversation"
            >
               <i className="fa-solid fa-code-branch"></i> FORK
            </button>
            <button 
              onClick={() => handleArchiveClick(id, text, variant)}
              disabled={isArchived(id, variant)}
              className={`uppercase text-[9px] tracking-widest border border-white/10 px-2 py-0.5 hover:bg-white hover:text-black ${isArchived(id, variant) ? 'text-emerald-500 border-emerald-500/30' : 'text-white/40'}`}
            >
                {isArchived(id, variant) ? 'ARCHIVED' : '+ ARCHIVE'}
            </button>
        </div>
      )}
    </div>
  );

  if (messages.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center select-none">
        <div className="text-2xl md:text-4xl tracking-[0.2em] text-white animate-pulse">
          NEXUS :: {config.provider.toUpperCase()}
        </div>
        <div className="mt-4 text-xs text-white/30 tracking-widest text-center max-w-md leading-relaxed">
          AWAITING INPUT STREAM<br />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 py-12">
      {messages.map((msg) => (
        <div key={msg.id} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
          
          {msg.comparisonText ? (
            // COMPARE MODE: Split View
            <div className="w-full grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-8">
               {/* Left Response */}
               <div className="relative group/msg border-l border-white/40 pl-4 text-left">
                  <MessageHeader role={msg.role} id={msg.id} text={msg.text} variant="OPT_A" />
                  <div className="text-sm md:text-base leading-relaxed whitespace-pre-wrap break-words w-full text-white/90">
                     <MarkdownRenderer content={msg.text} onSvgClick={onSvgClick} />
                  </div>
               </div>
               
               {/* Right Response */}
               <div className="relative group/msg border-l border-cyan-500/40 pl-4 text-left">
                  <MessageHeader role={msg.role} id={msg.id} text={msg.comparisonText} variant="OPT_B" />
                  <div className="text-sm md:text-base leading-relaxed whitespace-pre-wrap break-words w-full text-white/90">
                     <MarkdownRenderer content={msg.comparisonText} onSvgClick={onSvgClick} />
                  </div>
               </div>
            </div>
          ) : (
            // STANDARD MODE: Single View
            <div className={`
              max-w-[85%] md:max-w-[70%] relative group/msg
              ${msg.role === 'user'
                ? 'border-r border-white pr-4 text-right'
                : 'border-l border-white/40 pl-4 text-left'
              }
            `}>
              <MessageHeader role={msg.role} id={msg.id} text={msg.text} />
              
              {/* Attachments Display */}
              {msg.attachments && msg.attachments.length > 0 && (
                 <div className={`flex gap-2 mb-3 overflow-x-auto no-scrollbar ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                     {msg.attachments.map((att, i) => (
                         <div key={i} className="relative group/att border border-white/20 rounded bg-white/5 overflow-hidden flex-shrink-0" title={att.name || att.mimeType}>
                             {att.type === 'image' ? (
                                <img src={`data:${att.mimeType};base64,${att.data}`} className="h-16 w-16 object-cover" />
                             ) : (
                                <div className="h-16 w-16 flex flex-col items-center justify-center p-1 text-white/60">
                                   <i className="fa-solid fa-file-pdf text-xl mb-1"></i>
                                   <span className="text-[8px] uppercase">{att.mimeType.split('/')[1] || 'FILE'}</span>
                                </div>
                             )}
                         </div>
                     ))}
                 </div>
              )}

              <div className={`text-sm md:text-base leading-relaxed whitespace-pre-wrap break-words w-full ${msg.role === 'model' ? 'text-white/90' : 'text-white'}`}>
                {msg.role === 'model' ? (
                  <MarkdownRenderer content={msg.text} onSvgClick={onSvgClick} />
                ) : (
                  msg.text
                )}
                {msg.role === 'model' && isLoading && msg.id === messages[messages.length - 1].id && (
                  <span className="inline-block w-2 h-4 ml-1 bg-white animate-pulse align-middle" />
                )}
              </div>
            </div>
          )}

        </div>
      ))}
      <div ref={messagesEndRef} />
    </div>
  );
};

export default MessageList;
