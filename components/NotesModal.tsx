import React, { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getNotes, deleteNote, searchNotes, saveNote, sendHiveNote, checkUserExists } from '../services/dbService';
import { processDocument } from '../services/llmService';
import { Note, AppConfig } from '../types';
import MarkdownRenderer from './MarkdownRenderer';

type GetAccessToken = () => Promise<string | null>;

interface NotesModalProps {
  username: string;
  onClose: () => void;
  onSvgClick: (svgContent: string) => void;
  config: AppConfig;
  getToken: GetAccessToken;
}

const NotesModal: React.FC<NotesModalProps> = ({ username, onClose, onSvgClick, config, getToken }) => {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Transmit State
  const [isTransmitting, setIsTransmitting] = useState(false);
  const [recipient, setRecipient] = useState('');
  const [transmitStatus, setTransmitStatus] = useState<'idle' | 'success' | 'error' | 'not_found'>('idle');

  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: notes = [] } = useQuery({
    queryKey: ['notes', username, search],
    queryFn: () => search ? searchNotes(username, search) : getNotes(username)
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => deleteNote(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notes', username] });
      if (selectedNote) setSelectedNote(null);
    }
  });

  const transmitMutation = useMutation({
      mutationFn: async ({ note, recipient }: { note: Note, recipient: string }) => {
          sendHiveNote(note, username, recipient);
      },
      onSuccess: () => {
          setTransmitStatus('success');
          setTimeout(() => {
              setTransmitStatus('idle');
              setIsTransmitting(false);
              setRecipient('');
          }, 2000);
      },
      onError: () => {
          setTransmitStatus('error');
          setTimeout(() => setTransmitStatus('idle'), 2000);
      }
  });

  const handleDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    deleteMutation.mutate(id);
  };

  const handleTransmitSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      const targetUser = recipient.trim();
      if (!selectedNote || !targetUser) return;

      // Note: We skip the strict checkUserExists() call here because in a local simulation 
      // with alasql, the 'users' table might not be synced across tabs immediately.
      // We assume the user knows the correct username.
      
      transmitMutation.mutate({ note: selectedNote, recipient: targetUser });
  };

  const safeDate = (timestamp: number) => {
    try {
      return new Date(timestamp).toLocaleDateString() + ' ' + new Date(timestamp).toLocaleTimeString();
    } catch {
      return '';
    }
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    try {
        const base64 = await new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => {
              const res = reader.result as string;
              resolve(res.split(',')[1]);
            };
            reader.readAsDataURL(file);
        });

        const result = await processDocument(getToken, config, {
            type: file.type.startsWith('image/') ? 'image' : 'file',
            mimeType: file.type,
            data: base64,
            name: file.name
        });

        saveNote({
            id: Date.now().toString(),
            title: result.title || `Imported: ${file.name}`,
            content: result.content,
            timestamp: Date.now()
        }, username);

        queryClient.invalidateQueries({ queryKey: ['notes', username] });
        setSearch(''); // Reset search to show new note
        
    } catch (err: any) {
        alert(`Failed to import document: ${err.message}`);
    } finally {
        setIsProcessing(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 backdrop-blur-md p-4 animate-in fade-in">
      <div className="w-full max-w-4xl h-[85vh] border border-white/20 bg-black p-8 rounded relative shadow-2xl shadow-white/5 flex flex-col">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-white/50 to-transparent"></div>
        
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl text-white font-bold tracking-widest uppercase flex items-center gap-2">
            <i className="fa-solid fa-note-sticky text-sm"></i> Neural Archives
          </h2>
          <button onClick={onClose} className="text-white/50 hover:text-white">
            <i className="fa-solid fa-times"></i>
          </button>
        </div>

        {selectedNote ? (
          // Detailed View
          <div className="flex-1 flex flex-col overflow-hidden animate-in slide-in-right duration-300">
            <div className="flex flex-col md:flex-row md:items-center gap-4 mb-4 border-b border-white/10 pb-4">
               <button 
                  onClick={() => setSelectedNote(null)}
                  className="text-white/40 hover:text-white uppercase text-xs tracking-widest flex items-center gap-2"
               >
                  <i className="fa-solid fa-arrow-left"></i> Back
               </button>
               <div className="flex-1">
                  <h3 className="text-lg font-bold text-white uppercase tracking-wider truncate">{selectedNote.title}</h3>
                  <div className="text-[10px] text-white/30 uppercase tracking-widest">{safeDate(selectedNote.timestamp)}</div>
               </div>
               
               {/* Transmit Controls */}
               {isTransmitting ? (
                   <form onSubmit={handleTransmitSubmit} className="flex items-center gap-2 animate-in fade-in slide-in-right">
                       <input 
                          type="text" 
                          autoFocus
                          placeholder="RECIPIENT_ID" 
                          value={recipient}
                          onChange={(e) => setRecipient(e.target.value)}
                          className="bg-white/5 border border-white/20 text-white text-xs p-2 outline-none focus:border-cyan-400 w-32 uppercase placeholder:text-white/20"
                       />
                       <button 
                          type="submit"
                          disabled={transmitStatus !== 'idle'}
                          className={`px-3 py-2 text-xs font-bold uppercase transition-all flex items-center gap-2 ${
                              transmitStatus === 'success' ? 'bg-emerald-600 text-white' : 
                              transmitStatus === 'error' ? 'bg-red-600 text-white' : 
                              transmitStatus === 'not_found' ? 'bg-amber-600 text-white' :
                              'bg-cyan-900/50 text-cyan-400 border border-cyan-400 hover:bg-cyan-400 hover:text-black'
                          }`}
                       >
                           {transmitStatus === 'success' ? <i className="fa-solid fa-check"></i> : 
                            transmitStatus === 'error' ? <i className="fa-solid fa-triangle-exclamation"></i> : 
                            transmitStatus === 'not_found' ? <span className="text-[9px]">USER NOT FOUND</span> :
                            <i className="fa-solid fa-paper-plane"></i>}
                       </button>
                       <button 
                          type="button"
                          onClick={() => setIsTransmitting(false)}
                          className="text-white/40 hover:text-white px-2"
                       >
                           <i className="fa-solid fa-times"></i>
                       </button>
                   </form>
               ) : (
                   <button 
                      onClick={() => setIsTransmitting(true)}
                      className="bg-white/5 hover:bg-white hover:text-black border border-white/20 transition-all px-4 py-2 uppercase text-xs tracking-widest font-bold flex items-center gap-2"
                      title="Send to another user"
                   >
                      <i className="fa-solid fa-share-nodes"></i> Transmit
                   </button>
               )}
            </div>
            
            <div className="flex-1 overflow-y-auto pr-2 no-scrollbar">
               <div className="text-sm md:text-base leading-relaxed text-white/90">
                  <MarkdownRenderer content={selectedNote.content} onSvgClick={onSvgClick} />
               </div>
            </div>
          </div>
        ) : (
          // List View
          <>
            <div className="mb-6 flex gap-2">
                <div className="relative flex-1">
                    <i className="fa-solid fa-search absolute left-3 top-1/2 -translate-y-1/2 text-white/30"></i>
                    <input 
                        type="text" 
                        placeholder="SEARCH ARCHIVES..." 
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full bg-white/5 border border-white/10 text-white p-3 pl-10 text-sm focus:border-white/50 outline-none rounded-sm placeholder:text-white/20 uppercase tracking-wider"
                    />
                </div>
                <button 
                    onClick={handleImportClick}
                    disabled={isProcessing}
                    className="border border-white/20 hover:bg-white hover:text-black transition-all px-4 flex items-center gap-2 text-white disabled:opacity-50"
                    title="Import PDF or Image as Note"
                >
                    {isProcessing ? (
                        <i className="fa-solid fa-circle-notch animate-spin"></i>
                    ) : (
                        <i className="fa-solid fa-file-import"></i>
                    )}
                    <span className="hidden md:inline uppercase text-xs tracking-widest font-bold">Import</span>
                </button>
                <input 
                    type="file" 
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    accept="application/pdf,image/*"
                    className="hidden"
                />
            </div>

            <div className="flex-1 overflow-y-auto space-y-4 pr-2 no-scrollbar">
              {notes.length === 0 ? (
                <div className="text-center text-white/30 text-xs tracking-wider mt-20">
                    {search ? 'NO MATCHING RECORDS' : 'ARCHIVE EMPTY'}
                </div>
              ) : (
                notes.map(note => (
                  <div 
                    key={note.id}
                    onClick={() => setSelectedNote(note)}
                    className="group border border-white/10 bg-white/5 p-6 relative flex flex-col gap-2 hover:border-white/30 transition-all cursor-pointer hover:bg-white/10"
                  >
                    <div className="flex justify-between items-start">
                        <h3 className="text-white font-bold tracking-wider uppercase text-sm border-b border-white/10 pb-2 pr-8 truncate w-full">{note.title}</h3>
                        <button 
                            onClick={(e) => handleDelete(e, note.id)}
                            className="text-white/20 hover:text-red-500 transition-colors absolute right-4 top-6 z-10"
                            title="Delete Note"
                        >
                            <i className="fa-solid fa-trash text-xs"></i>
                        </button>
                    </div>
                    <div className="text-white/60 text-xs whitespace-pre-wrap font-mono leading-relaxed max-h-20 overflow-hidden relative">
                        {note.content.substring(0, 150)}...
                    </div>
                    <div className="text-[10px] text-white/30 uppercase tracking-widest mt-2 flex justify-end">
                        Captured: {safeDate(note.timestamp)}
                    </div>
                  </div>
                ))
              )}
            </div>
          </>
        )}
      </div>
      
      {/* Loading Overlay */}
      {isProcessing && (
          <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center z-[60] backdrop-blur-sm">
             <i className="fa-solid fa-brain text-4xl animate-pulse text-white mb-4"></i>
             <div className="text-white uppercase tracking-[0.2em] text-xs font-bold animate-pulse">Reading Document Structure...</div>
             <div className="text-white/40 text-[10px] mt-2 tracking-widest">Converting to Markdown</div>
          </div>
      )}
    </div>
  );
};

export default NotesModal;