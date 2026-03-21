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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--surface)]/80 backdrop-blur-[12px] p-4">
      <div className="w-full max-w-4xl h-[85vh] bg-[var(--surface-container-lowest)] border border-[var(--primary-container)]/30 shadow-[0_0_100px_rgba(0,243,255,0.1)] relative overflow-hidden flex flex-col">
        {/* Header */}
        <div className="nexus-modal-header">
          <span className="font-headline font-black uppercase text-xs tracking-[0.15em] text-[var(--primary-container)]">NEURAL_ARCHIVES</span>
          <button
            onClick={onClose}
            className="bg-[var(--surface-container)] border border-[var(--outline-variant)] text-[var(--on-surface-variant)] hover:text-[var(--primary-container)] transition-colors w-8 h-8 flex items-center justify-center"
          >
            <i className="fa-solid fa-times text-xs"></i>
          </button>
        </div>

        {selectedNote ? (
          // Detailed View
          <div className="flex-1 flex flex-col overflow-hidden p-6">
            <div className="flex flex-col md:flex-row md:items-center gap-4 mb-4 border-b border-[var(--outline-variant)]/20 pb-4">
               <button
                  onClick={() => setSelectedNote(null)}
                  className="text-[var(--on-surface-variant)] hover:text-[var(--primary-container)] uppercase text-xs tracking-widest flex items-center gap-2 font-headline"
               >
                  <i className="fa-solid fa-arrow-left"></i> Back
               </button>
               <div className="flex-1">
                  <h3 className="text-lg font-bold text-[var(--on-surface)] font-headline uppercase tracking-wider truncate">{selectedNote.title}</h3>
                  <div className="label-sm text-[var(--outline)] mt-1">{safeDate(selectedNote.timestamp)}</div>
               </div>

               {/* Transmit Controls */}
               {isTransmitting ? (
                   <form onSubmit={handleTransmitSubmit} className="flex items-center gap-2">
                       <div className="relative">
                         <i className="fa-solid fa-user absolute left-3 top-1/2 -translate-y-1/2 text-[var(--outline)] text-xs"></i>
                         <input
                            type="text"
                            autoFocus
                            placeholder="RECIPIENT_ID"
                            value={recipient}
                            onChange={(e) => setRecipient(e.target.value)}
                            className="nexus-input w-40 text-xs"
                         />
                       </div>
                       <button
                          type="submit"
                          disabled={transmitStatus !== 'idle'}
                          className={`px-3 py-2 text-xs font-bold uppercase transition-all flex items-center gap-2 font-headline tracking-widest ${
                              transmitStatus === 'success' ? 'bg-[var(--tertiary-container)] text-[var(--on-tertiary)]' :
                              transmitStatus === 'error' ? 'bg-[var(--error-container)] text-[var(--on-error)]' :
                              transmitStatus === 'not_found' ? 'bg-[var(--secondary-container)] text-[var(--on-secondary)]' :
                              'nexus-btn-primary'
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
                          className="text-[var(--on-surface-variant)] hover:text-[var(--primary-container)] px-2"
                       >
                           <i className="fa-solid fa-times"></i>
                       </button>
                   </form>
               ) : (
                   <button
                      onClick={() => setIsTransmitting(true)}
                      className="nexus-btn-primary flex items-center gap-2"
                      title="Send to another user"
                   >
                      <i className="fa-solid fa-share-nodes"></i> Transmit
                   </button>
               )}
            </div>

            <div className="flex-1 overflow-y-auto pr-2 no-scrollbar">
               <div className="text-sm md:text-base leading-relaxed text-[var(--primary)]">
                  <MarkdownRenderer content={selectedNote.content} onSvgClick={onSvgClick} />
               </div>
            </div>
          </div>
        ) : (
          // List View
          <>
            <div className="p-4 flex gap-2">
                <div className="relative flex-1">
                    <i className="fa-solid fa-search absolute left-3 top-1/2 -translate-y-1/2 text-[var(--outline)] text-xs"></i>
                    <input
                        type="text"
                        placeholder="SEARCH ARCHIVES..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="nexus-input"
                    />
                </div>
                <button
                    onClick={handleImportClick}
                    disabled={isProcessing}
                    className="nexus-btn-secondary flex items-center gap-2 disabled:opacity-50"
                    title="Import PDF or Image as Note"
                >
                    {isProcessing ? (
                        <i className="fa-solid fa-circle-notch animate-spin"></i>
                    ) : (
                        <i className="fa-solid fa-file-import"></i>
                    )}
                    <span className="hidden md:inline">Import</span>
                </button>
                <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    accept="application/pdf,image/*"
                    className="hidden"
                />
            </div>

            <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-1">
              {notes.length === 0 ? (
                <div className="text-center text-[var(--outline)] text-xs tracking-wider mt-20 uppercase font-headline">
                    {search ? 'NO MATCHING RECORDS' : 'ARCHIVE EMPTY'}
                </div>
              ) : (
                notes.map(note => (
                  <div
                    key={note.id}
                    onClick={() => setSelectedNote(note)}
                    className="nexus-list-item group relative flex-col items-start gap-2"
                  >
                    <div className="flex justify-between items-start w-full">
                        <h3 className="text-[var(--on-surface)] font-headline font-bold tracking-wider text-xs uppercase truncate flex-1 pr-6">{note.title}</h3>
                        <button
                            onClick={(e) => handleDelete(e, note.id)}
                            className="border border-transparent text-[var(--outline)] hover:text-[var(--error)] hover:border-[var(--error)]/30 opacity-0 group-hover:opacity-100 transition-all px-2 py-1 absolute right-2 top-2"
                            title="Delete Note"
                        >
                            <i className="fa-solid fa-trash text-xs"></i>
                        </button>
                    </div>
                    <div className="text-[var(--on-surface-variant)] text-xs font-mono leading-relaxed max-h-16 overflow-hidden w-full">
                        {note.content.substring(0, 150)}...
                    </div>
                    <div className="label-sm text-[var(--outline)] mt-1 self-end">
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
          <div className="absolute inset-0 bg-[var(--surface)]/80 flex flex-col items-center justify-center z-[60] backdrop-blur-sm">
             <i className="fa-solid fa-brain text-4xl animate-pulse text-[var(--primary-container)] mb-4"></i>
             <div className="text-[var(--primary-container)] uppercase tracking-[0.2em] text-xs font-bold font-headline animate-pulse">Reading Document Structure...</div>
             <div className="text-[var(--outline)] text-[10px] mt-2 tracking-widest font-headline">Converting to Markdown</div>
          </div>
      )}
    </div>
  );
};

export default NotesModal;
