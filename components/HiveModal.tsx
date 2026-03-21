
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--surface)]/80 backdrop-blur-[12px] p-4">
      <div className="w-full max-w-4xl h-[85vh] bg-[var(--surface-container-lowest)] border border-[var(--primary-container)]/30 shadow-[0_0_100px_rgba(0,243,255,0.1)] relative overflow-hidden flex flex-col">
        {/* Header - secondary (#FFABF3) accent */}
        <div className="bg-[var(--secondary)]/10 border-b border-[var(--secondary)]/20 px-6 py-3 flex justify-between items-center">
          <span className="font-headline font-black uppercase text-xs tracking-[0.15em] text-[var(--secondary)]">HIVE_NETWORK</span>
          <button
            onClick={onClose}
            className="bg-[var(--surface-container)] border border-[var(--outline-variant)] text-[var(--on-surface-variant)] hover:text-[var(--primary-container)] transition-colors w-8 h-8 flex items-center justify-center"
          >
            <i className="fa-solid fa-times text-xs"></i>
          </button>
        </div>

        {selectedTx ? (
           // View Mode
           <div className="flex-1 flex flex-col overflow-hidden p-6">
             <div className="flex items-center gap-4 mb-4 border-b border-[var(--outline-variant)]/20 pb-4">
                <button
                   onClick={() => setSelectedTx(null)}
                   className="text-[var(--on-surface-variant)] hover:text-[var(--secondary)] uppercase text-xs tracking-widest flex items-center gap-2 font-headline"
                >
                   <i className="fa-solid fa-arrow-left"></i> Back
                </button>
                <div className="flex-1">
                   <h3 className="text-lg font-bold text-[var(--on-surface)] font-headline uppercase tracking-wider">{selectedTx.title}</h3>
                   <div className="label-sm text-[var(--secondary)] mt-1">
                       SENDER: {selectedTx.sender} // {safeDate(selectedTx.timestamp)}
                   </div>
                </div>

                {/* Accept button with tertiary (#36FD0F) colors */}
                <button
                   onClick={handleAccept}
                   className="bg-[var(--tertiary-container)] text-[var(--on-tertiary)] px-6 py-2 font-headline font-bold uppercase tracking-widest text-xs hover:brightness-110 transition-all flex items-center gap-2 clip-path-none"
                   style={{ clipPath: 'polygon(0% 0%, 95% 0%, 100% 25%, 100% 100%, 5% 100%, 0% 75%)' }}
                >
                   <i className="fa-solid fa-download"></i> Accept Knowledge
                </button>
             </div>

             <div className="flex-1 overflow-y-auto pr-2 no-scrollbar">
                <div className="text-sm md:text-base leading-relaxed text-[var(--primary)]">
                   <MarkdownRenderer content={selectedTx.content} onSvgClick={onSvgClick} />
                </div>
             </div>
           </div>
        ) : (
          // List Mode
          <div className="flex-1 overflow-y-auto p-4 space-y-1">
            {transmissions.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-[var(--outline)] gap-4">
                    <i className="fa-solid fa-satellite-dish text-2xl opacity-50"></i>
                    <div className="text-xs tracking-widest uppercase font-headline">No Incoming Signals</div>
                </div>
            ) : (
                transmissions.map(tx => (
                    <div
                       key={tx.id}
                       onClick={() => setSelectedTx(tx)}
                       className="nexus-list-item group relative hover:border-l-[var(--secondary)]"
                    >
                        {/* Sender avatar with secondary accent */}
                        <div className="w-8 h-8 rounded-full bg-[var(--secondary-container)]/20 border border-[var(--secondary)]/30 flex items-center justify-center text-[var(--secondary)] group-hover:border-[var(--secondary)] transition-colors flex-shrink-0">
                            <i className="fa-solid fa-user text-xs"></i>
                        </div>
                        <div className="flex-1 overflow-hidden">
                            <div className="flex justify-between items-center mb-1">
                                <span className="text-xs text-[var(--secondary)] font-bold tracking-widest uppercase font-headline">From: {tx.sender}</span>
                                <span className="label-sm text-[var(--outline)]">{safeDate(tx.timestamp)}</span>
                            </div>
                            <div className="text-[var(--on-surface)] font-headline font-bold text-xs truncate uppercase tracking-wider">{tx.title}</div>
                        </div>
                        <button
                           onClick={(e) => handleDelete(e, tx.id)}
                           className="border border-transparent text-[var(--outline)] hover:text-[var(--error)] hover:border-[var(--error)]/30 opacity-0 group-hover:opacity-100 transition-all p-2"
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
