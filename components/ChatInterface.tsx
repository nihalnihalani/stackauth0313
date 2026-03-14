import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { UserButton } from '@stackframe/stack';
import { stackClientApp } from '../stack';
import { DEFAULT_CONFIG, MODES, MODELS } from '../constants';
import { Message, AppConfig, Attachment } from '../types';
import { streamResponse, generateTitle } from '../services/llmService';
import { createChatSession, saveMessage, getMessagesByChatId, updateChatTitle, saveNote, getChatSessions, getHiveTransmissions } from '../services/dbService';
import MessageList from './MessageList';
import InputArea from './InputArea';
import SettingsModal from './SettingsModal';
import SvgModal from './SvgModal';
import HistoryModal from './HistoryModal';
import NotesModal from './NotesModal';
import SyllabusModal from './SyllabusModal';
import HiveModal from './HiveModal';
import LiveInterface from './LiveInterface';

interface ChatInterfaceProps {
  username: string;
  displayName: string;
  onLogout: () => void;
}

const ChatInterface: React.FC<ChatInterfaceProps> = ({ username, displayName, onLogout }) => {
  const queryClient = useQueryClient();

  // Token getter for authenticated API calls
  const getToken = useCallback(async (): Promise<string | null> => {
    const auth = await stackClientApp.getAuthJson();
    return auth?.accessToken ?? null;
  }, []);

  const [input, setInput] = useState('');
  const [modalSvg, setModalSvg] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showNotes, setShowNotes] = useState(false);
  const [showSyllabus, setShowSyllabus] = useState(false);
  const [showHive, setShowHive] = useState(false);
  const [showLive, setShowLive] = useState(false);
  const [currentChatId, setCurrentChatId] = useState<string | null>(null);
  
  // Abort Controller for stopping generation
  const abortControllerRef = useRef<AbortController | null>(null);

  // Load config
  const [config, setConfig] = useState<AppConfig>(() => {
    const saved = localStorage.getItem('nexus_config');
    // Ensure we start with default model if local storage is stale or empty
    const parsed = saved ? JSON.parse(saved) : DEFAULT_CONFIG;
    // Migration: If config has old thinking model, update it? 
    // We'll let user toggle it manually or rely on default if missing.
    return parsed;
  });

  // Save config whenever it changes
  useEffect(() => {
    localStorage.setItem('nexus_config', JSON.stringify(config));
  }, [config]);

  // Start new session on mount if none, or if user changed
  useEffect(() => {
    // When username changes, we should look for the most recent session or create a new one
    const sessions = getChatSessions(username);
    if (sessions.length > 0) {
        setCurrentChatId(sessions[0].id);
    } else {
        handleNewSession();
    }
  }, [username]);

  // Poll for Hive Messages
  const { data: hiveMessages = [] } = useQuery({
    queryKey: ['hive', username],
    queryFn: () => getHiveTransmissions(username),
    refetchInterval: 5000 
  });

  const handleNewSession = () => {
    handleStop(); // Stop any pending generation
    const newSession = createChatSession(username);
    setCurrentChatId(newSession.id);
    queryClient.invalidateQueries({ queryKey: ['sessions', username] });
    queryClient.setQueryData(['messages', newSession.id], []);
  };

  const handleSelectChat = (chatId: string) => {
    handleStop(); // Stop active gen
    setCurrentChatId(chatId);
  };

  const toggleMode = () => {
    setConfig(prev => ({
      ...prev,
      mode: prev.mode === MODES.DIRECT ? MODES.SOCRATIC : MODES.DIRECT
    }));
  };

  const toggleModel = () => {
    setConfig(prev => ({
      ...prev,
      model: prev.model === MODELS.GEMINI_3 ? MODELS.GEMINI_2_5 : MODELS.GEMINI_3
    }));
  };

  // React Query for Messages
  const { data: messages = [] } = useQuery({
    queryKey: ['messages', currentChatId],
    queryFn: () => currentChatId ? getMessagesByChatId(currentChatId) : [],
    enabled: !!currentChatId,
  });

  const chatMutation = useMutation({
    mutationFn: async ({ userText, chatId, currentMsgs, isCompare, attachments, signal }: { userText: string, chatId: string, currentMsgs: Message[], isCompare?: boolean, attachments?: Attachment[], signal?: AbortSignal }) => {
      const userMsg: Message = { 
        id: Date.now().toString(), 
        chatId: chatId,
        role: 'user', 
        text: userText,
        timestamp: Date.now(),
        attachments: attachments
      };
      
      saveMessage(userMsg);
      
      // Update Title if needed or if it's a generic Fork title
      const sessions = getChatSessions(username);
      const currentSession = sessions.find(s => s.id === chatId);
      const isFork = currentSession?.title.startsWith('Fork:');
      
      if ((currentMsgs.length === 0 || isFork) && userText) {
        updateChatTitle(chatId, userText.slice(0, 30) + (userText.length > 30 ? '...' : ''));
        queryClient.invalidateQueries({ queryKey: ['sessions', username] });
      }

      // Optimistic Update: Add User Message + Placeholder AI Message
      const aiMsgId = (Date.now() + 1).toString();
      const aiMsg: Message = {
        id: aiMsgId,
        chatId: chatId,
        role: 'model',
        text: '',
        comparisonText: isCompare ? '' : undefined,
        timestamp: Date.now()
      };

      const updatedHistory = [...currentMsgs, userMsg];
      
      // Directly update cache for instant feedback
      queryClient.setQueryData(['messages', chatId], [...updatedHistory, aiMsg]);

      if (isCompare) {
        let fullTextA = '';
        let fullTextB = '';

        // Trigger two parallel streams
        const streamA = streamResponse(getToken, config, updatedHistory, userText, (chunk) => {
          fullTextA += chunk;
          queryClient.setQueryData(['messages', chatId], (old: Message[] | undefined) => {
             if (!old) return [];
             return old.map(m => m.id === aiMsgId ? { ...m, text: fullTextA, comparisonText: fullTextB } : m);
          });
        }, signal);

        const streamB = streamResponse(getToken, config, updatedHistory, userText, (chunk) => {
            fullTextB += chunk;
            queryClient.setQueryData(['messages', chatId], (old: Message[] | undefined) => {
               if (!old) return [];
               return old.map(m => m.id === aiMsgId ? { ...m, text: fullTextA, comparisonText: fullTextB } : m);
            });
          }, signal);

        await Promise.all([streamA, streamB]);
        
        const finalMsg = { ...aiMsg, text: fullTextA, comparisonText: fullTextB };
        saveMessage(finalMsg);
        return finalMsg;

      } else {
        // Standard Single Stream
        let fullText = '';
        await streamResponse(getToken, config, updatedHistory, userText, (chunk) => {
            fullText += chunk;
            queryClient.setQueryData(['messages', chatId], (old: Message[] | undefined) => {
               if (!old) return [];
               return old.map(m => m.id === aiMsgId ? { ...m, text: fullText } : m);
            });
        }, signal);
        const finalMsg = { ...aiMsg, text: fullText };
        saveMessage(finalMsg);
        return finalMsg;
      }
    },
    onError: (error: any, variables) => {
      // If error is abort error, ignore (user stopped)
      if (error.name === 'AbortError' || error.message.includes('aborted')) {
         return;
      }

      const { chatId } = variables;
      const errorMsg = `ERROR: ${error.message || 'CONNECTION TERMINATED.'}`;
      queryClient.setQueryData(['messages', chatId], (old: Message[] | undefined) => {
         if (!old) return [];
         const lastMsg = old[old.length - 1];
         if (lastMsg.role === 'model') {
             // Update the placeholder with error
             saveMessage({ ...lastMsg, text: errorMsg });
             return old.map(m => m.id === lastMsg.id ? { ...m, text: errorMsg } : m);
         }
         return old;
      });
    }
  });

  const handleStop = () => {
    if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
    }
  };

  const handleSend = async (e?: React.FormEvent, overrideText?: string, isCompare?: boolean, attachments?: Attachment[]) => {
    e?.preventDefault();
    const textToSend = overrideText !== undefined ? overrideText : input;
    
    // Stop any previous generation before starting new one
    handleStop();

    // Allow empty text if there are attachments
    if ((!textToSend.trim() && (!attachments || attachments.length === 0)) || chatMutation.isPending || !currentChatId) return;

    if (!overrideText) setInput('');

    // Create new controller for this request
    const controller = new AbortController();
    abortControllerRef.current = controller;

    chatMutation.mutate({ 
        userText: textToSend, 
        chatId: currentChatId, 
        currentMsgs: messages, 
        isCompare, 
        attachments,
        signal: controller.signal 
    });
  };

  const handleRegenerate = (isCompareMode: boolean) => {
     if (!messages.length) return;
     
     // Find the last user message to resend
     // Fix: findLastIndex is not supported in all environments, use manual loop
     let lastUserMsgIndex = -1;
     for (let i = messages.length - 1; i >= 0; i--) {
        if (messages[i].role === 'user') {
            lastUserMsgIndex = i;
            break;
        }
     }

     if (lastUserMsgIndex === -1) return;

     const msgToResend = messages[lastUserMsgIndex];
     
     // Remove any messages after this user message (e.g. the model response we want to replace)
     const msgsToKeep = messages.slice(0, lastUserMsgIndex);
     
     // Update UI/Cache immediately to remove old response
     queryClient.setQueryData(['messages', currentChatId], msgsToKeep);
     
     // Trigger send again with same text/attachments, but using the NEW isCompareMode passed from UI
     // Note: We are essentially "editing" history by truncating and re-appending
     handleSend(undefined, msgToResend.text, isCompareMode, msgToResend.attachments);
  };

  const handleArchive = async (text: string) => {
    const title = await generateTitle(getToken, config, text);
    saveNote({
        id: Date.now().toString(),
        title: title,
        content: text,
        timestamp: Date.now()
    }, username);
    queryClient.invalidateQueries({ queryKey: ['notes', username] });
  };

  const handleBranch = (messageId: string, specificText?: string) => {
    const msgIndex = messages.findIndex(m => m.id === messageId);
    if (msgIndex === -1 || !currentChatId) return;
    
    const sessions = getChatSessions(username);
    const currentSession = sessions.find(s => s.id === currentChatId);
    const oldTitle = currentSession?.title || 'Session';
    const newSession = createChatSession(username, `Fork: ${oldTitle}`);
    
    // Copy history up to point
    const msgsToCopy = messages.slice(0, msgIndex + 1);
    
    msgsToCopy.forEach((msg, idx) => {
        let textToSave = msg.text;
        if (msg.id === messageId && specificText) {
            textToSave = specificText;
        }

        saveMessage({
            ...msg,
            id: Date.now().toString() + '_' + idx,
            chatId: newSession.id,
            text: textToSave,
            comparisonText: undefined, 
            timestamp: Date.now() + idx
        });
    });
    
    queryClient.invalidateQueries({ queryKey: ['sessions', username] });
    queryClient.invalidateQueries({ queryKey: ['messages'] });
    setCurrentChatId(newSession.id);
  };

  const handleSyllabusFork = (topicTitle: string) => {
     const newSession = createChatSession(username, `Study: ${topicTitle}`);
     setCurrentChatId(newSession.id);
     setShowSyllabus(false);
     
     setTimeout(() => {
         chatMutation.mutate({ 
             userText: `Teach me about "${topicTitle}" in detail. Start with the core concepts.`, 
             chatId: newSession.id, 
             currentMsgs: [] 
         });
     }, 100);
  };

  return (
    <div className="flex flex-col h-screen w-[95%] md:w-[90%] mx-auto p-4 md:p-8 font-mono relative">

      {/* Vertical Status Line */}
      <div className="fixed left-6 top-1/2 -translate-y-1/2 z-20 hidden md:flex items-center justify-center w-0 h-0 mix-blend-difference">
        <div className="-rotate-90 whitespace-nowrap text-xs text-white/30 tracking-[0.3em] select-none uppercase font-bold">
          System_Ready // {displayName} // {config.mode}
        </div>
      </div>

      {/* Mode Toggle & New Session (Left Side) */}
      <div className="absolute top-4 left-4 md:left-8 z-20 flex gap-2">
        <button
          onClick={toggleMode}
          className={`uppercase text-[10px] tracking-[0.2em] font-bold flex items-center gap-2 border px-3 py-1.5 transition-all
            ${config.mode === MODES.SOCRATIC 
              ? 'bg-white text-black border-white hover:bg-black hover:text-white' 
              : 'bg-black text-white/60 border-white/20 hover:text-white hover:border-white'
            }`}
        >
          {config.mode === MODES.SOCRATIC ? 'SOCRATIC' : 'DIRECT'}
        </button>

        <button
          onClick={toggleModel}
          className={`uppercase text-[10px] tracking-[0.2em] font-bold flex items-center gap-2 border px-3 py-1.5 transition-all
            ${config.model === MODELS.GEMINI_3 
              ? 'bg-purple-900/50 text-purple-400 border-purple-400 shadow-[0_0_10px_rgba(192,132,252,0.2)]' 
              : 'bg-black text-white/60 border-white/20 hover:text-white hover:border-white'
            }`}
          title="Switch Model Core"
        >
          {config.model === MODELS.GEMINI_3 ? 'G-3.0 PRO' : 'G-2.5 FLASH'}
        </button>

        <button
          onClick={handleNewSession}
          className="uppercase text-[10px] tracking-[0.2em] font-bold flex items-center justify-center border border-white/20 px-3 py-1.5 transition-all bg-black text-white hover:bg-white hover:text-black hover:border-white w-10"
          title="New Session"
        >
          <i className="fa-solid fa-plus"></i>
        </button>
      </div>

      {/* Right Controls */}
      <div className="absolute top-4 right-4 md:right-8 z-20 flex items-center gap-4">
        
        <button
          onClick={() => setShowLive(true)}
          className="uppercase text-[10px] tracking-[0.2em] font-bold flex items-center gap-2 border border-red-500/30 px-3 py-1.5 transition-all bg-black text-red-400 hover:bg-red-500 hover:text-white shadow-[0_0_10px_rgba(239,68,68,0.2)]"
        >
           <i className="fa-solid fa-microphone-lines animate-pulse"></i>
           <span className="hidden md:inline">VOICE LINK</span>
        </button>

        <button
          onClick={() => setShowHive(true)}
          className="uppercase text-[10px] tracking-[0.2em] font-bold flex items-center gap-2 border border-white/20 px-3 py-1.5 transition-all bg-black text-white hover:bg-white hover:text-black hover:border-white relative"
        >
          <i className="fa-solid fa-network-wired text-xs"></i>
          <span className="hidden md:inline">HIVE</span>
          {hiveMessages.length > 0 && (
             <span className="absolute -top-1 -right-1 flex h-3 w-3">
               <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
               <span className="relative inline-flex rounded-full h-3 w-3 bg-cyan-500"></span>
             </span>
          )}
        </button>

        <button
          onClick={() => setShowSyllabus(true)}
          className="uppercase text-[10px] tracking-[0.2em] font-bold flex items-center gap-2 border border-white/20 px-3 py-1.5 transition-all bg-black text-white hover:bg-white hover:text-black hover:border-white"
        >
          <i className="fa-solid fa-sitemap text-xs"></i>
          <span className="hidden md:inline">SYLLABUS</span>
        </button>

        <button
          onClick={() => setShowNotes(true)}
          className="uppercase text-[10px] tracking-[0.2em] font-bold flex items-center gap-2 border border-white/20 px-3 py-1.5 transition-all bg-black text-white hover:bg-white hover:text-black hover:border-white"
        >
          <i className="fa-solid fa-note-sticky text-xs"></i>
          <span className="hidden md:inline">NOTES</span>
        </button>

        <button
          onClick={() => setShowHistory(true)}
          className="uppercase text-[10px] tracking-[0.2em] font-bold flex items-center gap-2 border border-white/20 px-3 py-1.5 transition-all bg-black text-white hover:bg-white hover:text-black hover:border-white"
        >
          <i className="fa-solid fa-clock-rotate-left text-xs"></i>
          <span className="hidden md:inline">HISTORY</span>
        </button>

        <button
          onClick={() => setShowSettings(true)}
          className="text-white/60 hover:text-white transition-colors ml-2"
          title="Configure Neural Link"
        >
          <i className="fa-solid fa-gear text-lg"></i>
        </button>

        <div className="ml-2">
          <UserButton />
        </div>
      </div>

      {/* Modals */}
      {showSettings && (
        <SettingsModal 
          config={config} 
          setConfig={setConfig} 
          onClose={() => setShowSettings(false)} 
        />
      )}

      {showHistory && (
        <HistoryModal
          username={username}
          onClose={() => setShowHistory(false)}
          onSelectChat={handleSelectChat}
          onNewChat={handleNewSession}
        />
      )}

      {showNotes && (
        <NotesModal
          username={username}
          onClose={() => setShowNotes(false)}
          onSvgClick={setModalSvg}
          config={config}
          getToken={getToken}
        />
      )}

      {showSyllabus && (
        <SyllabusModal
          username={username}
          onClose={() => setShowSyllabus(false)}
          config={config}
          onSvgClick={setModalSvg}
          onFork={handleSyllabusFork}
          getToken={getToken}
        />
      )}
      
      {showHive && (
        <HiveModal
          username={username}
          onClose={() => setShowHive(false)}
          onSvgClick={setModalSvg}
        />
      )}

      {showLive && (
        <LiveInterface
          config={config}
          onClose={() => setShowLive(false)}
          username={username}
        />
      )}

      {modalSvg && (
        <SvgModal 
          content={modalSvg} 
          onClose={() => setModalSvg(null)} 
        />
      )}

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto mb-16 pr-2 no-scrollbar">
        <MessageList 
          messages={messages} 
          isLoading={chatMutation.isPending} 
          onSvgClick={setModalSvg} 
          onArchive={handleArchive}
          onBranch={handleBranch}
          config={config}
        />
      </div>

      {/* Input Area */}
      <InputArea 
        input={input} 
        setInput={setInput} 
        handleSend={handleSend} 
        isLoading={chatMutation.isPending}
        mode={config.mode}
        onStop={handleStop}
        onRegenerate={handleRegenerate}
        hasHistory={messages.length > 0}
      />
    </div>
  );
};

export default ChatInterface;