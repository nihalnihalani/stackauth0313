
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 backdrop-blur-md p-4 animate-in fade-in">
      <div className="w-full max-w-md h-[80vh] border border-white/20 bg-black p-8 rounded relative shadow-2xl shadow-white/5 flex flex-col">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-white/50 to-transparent"></div>
        
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl text-white font-bold tracking-widest uppercase flex items-center gap-2">
            <i className="fa-solid fa-clock-rotate-left text-sm"></i> History
          </h2>
          <button onClick={onClose} className="text-white/50 hover:text-white">
            <i className="fa-solid fa-times"></i>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto space-y-2 pr-2 no-scrollbar mb-4">
          {sessions.length === 0 ? (
            <div className="text-center text-white/30 text-xs tracking-wider mt-10">NO RECORDS FOUND</div>
          ) : (
            sessions.map(session => (
              <div 
                key={session.id}
                onClick={() => { onSelectChat(session.id); onClose(); }}
                className="group border border-white/10 bg-white/5 hover:border-white/40 hover:bg-white/10 p-4 cursor-pointer transition-all relative"
              >
                <div className="text-sm text-white/90 font-mono truncate pr-6">{session.title || 'Untitled Session'}</div>
                <div className="text-[10px] text-white/40 mt-1 uppercase tracking-wider">
                  {safeDate(session.timestamp)}
                </div>
                <button 
                  onClick={(e) => handleDelete(e, session.id)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-white/20 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all px-2 py-1"
                  title="Delete Record"
                >
                  <i className="fa-solid fa-trash text-xs"></i>
                </button>
              </div>
            ))
          )}
        </div>

        {/* Database Controls */}
        <div className="pt-4 border-t border-white/10 flex gap-3">
          <button 
            onClick={handleExport}
            className="flex-1 border border-white/10 bg-white/5 hover:bg-white hover:text-black py-2 text-[10px] uppercase tracking-widest transition-all flex flex-col items-center gap-1"
          >
            <i className="fa-solid fa-floppy-disk text-lg"></i>
            Backup DB
          </button>
          
          <button 
            onClick={handleImportClick}
            className="flex-1 border border-white/10 bg-white/5 hover:bg-white hover:text-black py-2 text-[10px] uppercase tracking-widest transition-all flex flex-col items-center gap-1"
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
