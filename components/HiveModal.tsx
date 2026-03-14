
import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getHiveTransmissions, deleteHiveTransmission, saveNote, HiveTransmission } from '../services/dbService';
import MarkdownRenderer from './MarkdownRenderer';

interface HiveModalProps {
  username: string;
  onClose: () => void;
  onSvgClick: (svgContent: string) => void;
}

const HiveModal: React.FC<HiveModalProps> = ({ username, onClose, onSvgClick }) => {
  const queryClient = useQueryClient();
  const [selectedTx, setSelectedTx] = useState<HiveTransmission | null>(null);

  const { data: transmissions = [] } = useQuery({
    queryKey: ['hive', username],
    queryFn: () => getHiveTransmissions(username),
    refetchInterval: 5000 // Poll for new messages every 5s since we are simulating local network
  });

  const acceptMutation = useMutation({
    mutationFn: async (tx: HiveTransmission) => {
       // Save to my notes
       saveNote({
           id: Date.now().toString(),
           title: `[FROM: ${tx.sender}] ${tx.title}`,
           content: tx.content,
           timestamp: Date.now()
       }, username);
       
       // Remove from inbox
       deleteHiveTransmission(tx.id);
    },
    onSuccess: () => {
       queryClient.invalidateQueries({ queryKey: ['hive', username] });
       queryClient.invalidateQueries({ queryKey: ['notes', username] }); // Refresh notes so they see the new one
       setSelectedTx(null);
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
       deleteHiveTransmission(id);
    },
    onSuccess: () => {
       queryClient.invalidateQueries({ queryKey: ['hive', username] });
       if (selectedTx) setSelectedTx(null);
    }
  });

  const handleAccept = () => {
    if (selectedTx) acceptMutation.mutate(selectedTx);
  };

  const handleDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    deleteMutation.mutate(id);
  };

  const safeDate = (timestamp: number) => {
    try {
      return new Date(timestamp).toLocaleDateString() + ' ' + new Date(timestamp).toLocaleTimeString();
    } catch {
      return '';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 backdrop-blur-md p-4 animate-in fade-in">
      <div className="w-full max-w-4xl h-[85vh] border border-cyan-900/50 bg-black p-8 rounded relative shadow-2xl shadow-cyan-500/10 flex flex-col">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-cyan-500/50 to-transparent"></div>
        
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl text-cyan-400 font-bold tracking-widest uppercase flex items-center gap-2">
            <i className="fa-solid fa-network-wired text-sm"></i> The Hive // Incoming
          </h2>
          <button onClick={onClose} className="text-white/50 hover:text-white">
            <i className="fa-solid fa-times"></i>
          </button>
        </div>

        {selectedTx ? (
           // View Mode
           <div className="flex-1 flex flex-col overflow-hidden animate-in slide-in-right duration-300">
             <div className="flex items-center gap-4 mb-4 border-b border-white/10 pb-4">
                <button 
                   onClick={() => setSelectedTx(null)}
                   className="text-white/40 hover:text-white uppercase text-xs tracking-widest flex items-center gap-2"
                >
                   <i className="fa-solid fa-arrow-left"></i> Back
                </button>
                <div className="flex-1">
                   <h3 className="text-lg font-bold text-white uppercase tracking-wider">{selectedTx.title}</h3>
                   <div className="text-[10px] text-cyan-400 uppercase tracking-widest">
                       SENDER: {selectedTx.sender} // {safeDate(selectedTx.timestamp)}
                   </div>
                </div>
                
                <button 
                   onClick={handleAccept}
                   className="bg-cyan-900/30 text-cyan-400 border border-cyan-500/50 hover:bg-cyan-500 hover:text-black transition-all px-4 py-2 uppercase text-xs tracking-widest font-bold flex items-center gap-2"
                >
                   <i className="fa-solid fa-download"></i> Accept Knowledge
                </button>
             </div>
             
             <div className="flex-1 overflow-y-auto pr-2 no-scrollbar">
                <div className="text-sm md:text-base leading-relaxed text-white/90">
                   <MarkdownRenderer content={selectedTx.content} onSvgClick={onSvgClick} />
                </div>
             </div>
           </div>
        ) : (
          // List Mode
          <div className="flex-1 overflow-y-auto space-y-2 pr-2 no-scrollbar">
            {transmissions.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-white/30 gap-4">
                    <i className="fa-solid fa-satellite-dish text-2xl opacity-50"></i>
                    <div className="text-xs tracking-widest uppercase">No Incoming Signals</div>
                </div>
            ) : (
                transmissions.map(tx => (
                    <div 
                       key={tx.id}
                       onClick={() => setSelectedTx(tx)}
                       className="group border border-white/10 bg-white/5 p-4 cursor-pointer hover:border-cyan-500/50 hover:bg-cyan-900/10 transition-all relative flex items-center gap-4"
                    >
                        <div className="w-10 h-10 rounded-full border border-white/20 flex items-center justify-center text-white/40 group-hover:text-cyan-400 group-hover:border-cyan-400 transition-colors">
                            <i className="fa-solid fa-user"></i>
                        </div>
                        <div className="flex-1 overflow-hidden">
                            <div className="flex justify-between items-center mb-1">
                                <span className="text-xs text-cyan-500 font-bold tracking-widest uppercase">From: {tx.sender}</span>
                                <span className="text-[9px] text-white/30 uppercase tracking-widest">{safeDate(tx.timestamp)}</span>
                            </div>
                            <div className="text-white font-bold text-sm truncate uppercase tracking-wider">{tx.title}</div>
                        </div>
                        <button 
                           onClick={(e) => handleDelete(e, tx.id)}
                           className="text-white/20 hover:text-red-500 transition-colors p-2"
                           title="Discard"
                        >
                           <i className="fa-solid fa-trash text-xs"></i>
                        </button>
                    </div>
                ))
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default HiveModal;
