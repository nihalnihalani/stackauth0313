
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
    <div className="label-sm text-[var(--on-surface-variant)] mb-2 flex items-center gap-2 justify-between">
      <span>{role === 'user' ? 'USER_01' : `SYSTEM_AI [${config.provider}]${variant ? ' // ' + variant : ''}`}</span>
      {role === 'model' && (
        <div className="flex gap-2 opacity-0 group-hover/msg:opacity-100 transition-opacity">
            <button
              onClick={() => onBranch(id, text)}
              className="label-sm px-2 py-0.5 bg-[var(--surface-container-high)] border border-[var(--outline-variant)]/20 text-[var(--on-surface-variant)] hover:brightness-110 hover:text-[var(--primary-container)] transition-all flex items-center gap-1"
              title="Fork Conversation"
            >
               <i className="fa-solid fa-code-branch"></i> FORK
            </button>
            <button
              onClick={() => handleArchiveClick(id, text, variant)}
              disabled={isArchived(id, variant)}
              className={`label-sm px-2 py-0.5 border border-[var(--outline-variant)]/20 transition-all ${isArchived(id, variant) ? 'text-[var(--tertiary-container)] border-[var(--tertiary-container)]/30 bg-[var(--surface-container)]' : 'bg-[var(--surface-container-high)] text-[var(--on-surface-variant)] hover:brightness-110'}`}
            >
                {isArchived(id, variant) ? 'ARCHIVED' : '+ ARCHIVE'}
            </button>
        </div>
      )}
    </div>
  );

  if (messages.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center select-none py-32">
        <div className="font-headline text-2xl md:text-4xl tracking-[0.2em] text-[var(--primary-container)] animate-pulse-glow inline-block px-4 py-2">
          NEXUS :: {config.provider.toUpperCase()}
        </div>
        <div className="mt-4 label-sm text-[var(--on-surface-variant)] text-center max-w-md leading-relaxed">
          AWAITING INPUT STREAM
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 py-12 max-w-4xl mx-auto">
      {messages.map((msg) => (
        <div key={msg.id} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>

          {msg.comparisonText ? (
            // COMPARE MODE: Split View
            <div className="w-full max-w-6xl mx-auto space-y-4">
              <div className="flex items-center gap-4 px-2">
                <div className="h-[1px] flex-1 bg-[var(--outline-variant)]/30"></div>
                <span className="label-sm text-[var(--tertiary)] tracking-[0.3em]">SYSTEM RESPONSE [COMPARE_MODE: ENABLED]</span>
                <div className="h-[1px] flex-1 bg-[var(--outline-variant)]/30"></div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                 {/* Option A */}
                 <div className="relative group/msg bg-[var(--surface-container-lowest)] border border-[var(--outline-variant)]/20 p-6">
                    <div className="absolute top-0 right-0 bg-[var(--primary-container)]/10 px-3 py-1 border-b border-l border-[var(--outline-variant)]/20">
                      <span className="label-sm text-[var(--primary-container)] font-black">OPT_A</span>
                    </div>
                    <MessageHeader role={msg.role} id={msg.id} text={msg.text} variant="OPT_A" />
                    <div className="nexus-message-ai">
                       <MarkdownRenderer content={msg.text} onSvgClick={onSvgClick} />
                    </div>
                 </div>

                 {/* Option B */}
                 <div className="relative group/msg bg-[var(--surface-container-lowest)] border border-[var(--outline-variant)]/20 p-6">
                    <div className="absolute top-0 right-0 bg-[var(--tertiary-container)]/10 px-3 py-1 border-b border-l border-[var(--outline-variant)]/20">
                      <span className="label-sm text-[var(--tertiary)] font-black">OPT_B</span>
                    </div>
                    <MessageHeader role={msg.role} id={msg.id} text={msg.comparisonText} variant="OPT_B" />
                    <div className="nexus-message-ai text-[var(--tertiary)]">
                       <MarkdownRenderer content={msg.comparisonText} onSvgClick={onSvgClick} />
                    </div>
                 </div>
              </div>
            </div>
          ) : (
            // STANDARD MODE: Single View
            <div className={`
              max-w-[85%] md:max-w-[70%] relative group/msg
              ${msg.role === 'user'
                ? 'nexus-message-user'
                : 'pl-4 text-left'
              }
            `}>
              <MessageHeader role={msg.role} id={msg.id} text={msg.text} />

              {/* Attachments Display */}
              {msg.attachments && msg.attachments.length > 0 && (
                 <div className={`flex gap-2 mb-3 overflow-x-auto no-scrollbar ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                     {msg.attachments.map((att, i) => (
                         <div key={i} className="relative group/att border border-[var(--outline-variant)]/20 rounded-none bg-[var(--surface-container)] overflow-hidden flex-shrink-0" title={att.name || att.mimeType}>
                             {att.type === 'image' ? (
                                <img src={`data:${att.mimeType};base64,${att.data}`} className="h-16 w-16 object-cover" />
                             ) : (
                                <div className="h-16 w-16 flex flex-col items-center justify-center p-1 text-[var(--on-surface-variant)]">
                                   <i className="fa-solid fa-file-pdf text-xl mb-1"></i>
                                   <span className="text-[8px] uppercase">{att.mimeType.split('/')[1] || 'FILE'}</span>
                                </div>
                             )}
                         </div>
                     ))}
                 </div>
              )}

              <div className={`text-sm md:text-base leading-relaxed whitespace-pre-wrap break-words w-full ${msg.role === 'model' ? 'nexus-message-ai' : 'text-[var(--on-surface)]'}`}>
                {msg.role === 'model' ? (
                  <MarkdownRenderer content={msg.text} onSvgClick={onSvgClick} />
                ) : (
                  msg.text
                )}
                {msg.role === 'model' && isLoading && msg.id === messages[messages.length - 1].id && (
                  <span className="inline-block w-2 h-4 ml-1 bg-[var(--primary-container)] animate-pulse align-middle" />
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
