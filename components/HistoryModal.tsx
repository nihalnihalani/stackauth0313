
import React, { useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getChatSessions, deleteChatSession, exportBackup, importBackup } from '../services/dbService';

interface HistoryModalProps {
  username: string;
  onClose: () => void;
  onSelectChat: (chatId: string) => void;
  onNewChat: () => void;
}

const HistoryModal: React.FC<HistoryModalProps> = ({ username, onClose, onSelectChat, onNewChat }) => {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: sessions = [] } = useQuery({
    queryKey: ['sessions', username],
    queryFn: () => getChatSessions(username)
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      deleteChatSession(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sessions', username] });
    }
  });

  const handleDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    deleteMutation.mutate(id);
  };

  const handleExport = () => {
    exportBackup(username);
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      await importBackup(file, username);
      queryClient.invalidateQueries({ queryKey: ['sessions', username] });
      queryClient.invalidateQueries({ queryKey: ['messages'] });
      queryClient.invalidateQueries({ queryKey: ['notes', username] });
      queryClient.invalidateQueries({ queryKey: ['syllabus', username] });
      alert("Database Restored Successfully");
    } catch (err) {
      alert("Failed to restore database. Invalid file.");
    }
  };

  const safeDate = (timestamp: number) => {
    try {
      return new Date(timestamp).toLocaleString();
    } catch (e) {
      return 'Unknown Date';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--surface)]/80 backdrop-blur-[12px] p-4">
      <div className="w-full max-w-md h-[80vh] bg-[var(--surface-container-lowest)] border border-[var(--primary-container)]/30 shadow-[0_0_100px_rgba(0,243,255,0.1)] relative overflow-hidden flex flex-col">
        {/* Header */}
        <div className="nexus-modal-header">
          <span className="font-headline font-black uppercase text-xs tracking-[0.15em] text-[var(--primary-container)]">SESSION_ARCHIVE</span>
          <button
            onClick={onClose}
            className="bg-[var(--surface-container)] border border-[var(--outline-variant)] text-[var(--on-surface-variant)] hover:text-[var(--primary-container)] transition-colors w-8 h-8 flex items-center justify-center"
          >
            <i className="fa-solid fa-times text-xs"></i>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-1">
          {sessions.length === 0 ? (
            <div className="text-center text-[var(--outline)] text-xs tracking-wider mt-10 uppercase font-headline">NO RECORDS FOUND</div>
          ) : (
            sessions.map(session => (
              <div
                key={session.id}
                onClick={() => { onSelectChat(session.id); onClose(); }}
                className="nexus-list-item group relative"
              >
                <div className="flex-1 overflow-hidden">
                  <div className="text-sm text-[var(--on-surface)] font-headline truncate uppercase tracking-wider">{session.title || 'Untitled Session'}</div>
                  <div className="label-sm text-[var(--outline)] mt-1">
                    {safeDate(session.timestamp)}
                  </div>
                </div>
                <button
                  onClick={(e) => handleDelete(e, session.id)}
                  className="border border-transparent text-[var(--outline)] hover:text-[var(--error)] hover:border-[var(--error)]/30 opacity-0 group-hover:opacity-100 transition-all px-2 py-1"
                  title="Delete Record"
                >
                  <i className="fa-solid fa-trash text-xs"></i>
                </button>
              </div>
            ))
          )}
        </div>

        {/* Database Controls */}
        <div className="p-4 border-t border-[var(--primary-container)]/20 flex gap-3">
          <button
            onClick={handleExport}
            className="nexus-btn-secondary flex-1 flex flex-col items-center gap-1 py-3"
          >
            <i className="fa-solid fa-floppy-disk text-lg"></i>
            Backup DB
          </button>

          <button
            onClick={handleImportClick}
            className="nexus-btn-secondary flex-1 flex flex-col items-center gap-1 py-3"
          >
            <i className="fa-solid fa-file-import text-lg"></i>
            Restore DB
          </button>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept=".json"
            className="hidden"
          />
        </div>
      </div>
    </div>
  );
};

export default HistoryModal;
