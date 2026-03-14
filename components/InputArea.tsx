
import React, { useState, useRef } from 'react';
import { MODES } from '../constants';
import { Attachment } from '../types';

interface InputAreaProps {
  input: string;
  setInput: (value: string) => void;
  handleSend: (e?: React.FormEvent, overrideText?: string, isCompare?: boolean, attachments?: Attachment[]) => void;
  isLoading: boolean;
  mode?: string;
  onStop?: () => void;
  onRegenerate?: (isCompare: boolean) => void;
  hasHistory?: boolean;
}

const InputArea: React.FC<InputAreaProps> = ({ 
    input, 
    setInput, 
    handleSend, 
    isLoading, 
    mode, 
    onStop, 
    onRegenerate,
    hasHistory 
}) => {
  const [isCompare, setIsCompare] = useState(false);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const onSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    handleSend(undefined, undefined, isCompare, attachments);
    setAttachments([]);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files) as File[];
      const newAttachments: Attachment[] = [];

      for (const file of files) {
        try {
            const base64 = await new Promise<string>((resolve) => {
                const reader = new FileReader();
                reader.onloadend = () => {
                    const res = reader.result as string;
                    // remove data:mime/type;base64, prefix
                    resolve(res.split(',')[1]); 
                };
                reader.readAsDataURL(file);
            });

            newAttachments.push({
                type: file.type.startsWith('image/') ? 'image' : 'file',
                mimeType: file.type,
                data: base64,
                name: file.name
            });
        } catch (err) {
            console.error("Error reading file", file.name, err);
        }
      }
      setAttachments(prev => [...prev, ...newAttachments]);
      // Reset input so same file can be selected again if needed
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  return (
    <div className="fixed bottom-0 left-0 w-full bg-black/90 backdrop-blur-sm border-t border-white/10 z-10">
      
      {/* Attachment Preview Bar */}
      {attachments.length > 0 && (
          <div className="w-full px-4 py-2 bg-white/5 border-b border-white/10 flex gap-4 overflow-x-auto no-scrollbar">
              {attachments.map((att, i) => (
                  <div key={i} className="relative group flex-shrink-0 animate-in fade-in slide-in-bottom duration-300">
                      {att.type === 'image' ? (
                          <div className="h-16 w-16 rounded border border-white/20 overflow-hidden bg-black">
                             <img src={`data:${att.mimeType};base64,${att.data}`} alt="preview" className="h-full w-full object-cover opacity-70 group-hover:opacity-100 transition-opacity" />
                          </div>
                      ) : (
                          <div className="h-16 w-16 rounded border border-white/20 bg-white/10 flex flex-col items-center justify-center text-white/50 group-hover:text-white transition-colors">
                              <i className="fa-solid fa-file-pdf text-xl mb-1"></i>
                              <span className="text-[8px] uppercase tracking-widest max-w-full truncate px-1">{att.mimeType.split('/')[1]}</span>
                          </div>
                      )}
                      <button 
                        onClick={() => removeAttachment(i)}
                        className="absolute -top-2 -right-2 bg-red-900/80 hover:bg-red-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-[10px] border border-white/20 transition-colors"
                      >
                          <i className="fa-solid fa-times"></i>
                      </button>
                  </div>
              ))}
          </div>
      )}

      <div className="w-[95%] md:w-[90%] mx-auto flex items-center gap-3 py-3 md:py-5">
        {/* Prompt symbol aligned with flex center */}
        <span className={`text-lg animate-pulse hidden md:block font-bold opacity-80 leading-none select-none pb-0.5 h-10 flex items-center ${mode === MODES.SOCRATIC ? 'text-amber-500' : 'text-white'}`}>
          {mode === MODES.SOCRATIC ? '?' : '>'}
        </span>
        
        <form onSubmit={onSubmit} className="flex-1">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={mode === MODES.SOCRATIC ? "Enter response..." : "Initiate command..."}
            className="w-full h-10 bg-transparent border-b border-white/20 focus:border-white outline-none text-white font-mono text-sm transition-all placeholder:text-white/20 px-2"
            autoFocus
          />
        </form>

        {isLoading ? (
            <button
              onClick={onStop}
              className="h-10 bg-red-900/50 text-white border border-red-500/50 hover:bg-red-600 transition-all uppercase text-[10px] tracking-widest px-6 font-bold flex items-center justify-center whitespace-nowrap animate-pulse"
            >
              STOP
            </button>
        ) : (
            <button
              onClick={() => onSubmit()}
              disabled={(!input.trim() && attachments.length === 0)}
              className="h-10 bg-black text-white border border-white hover:invert disabled:opacity-50 disabled:hover:invert-0 transition-all uppercase text-[10px] tracking-widest px-6 font-bold flex items-center justify-center whitespace-nowrap"
            >
              EXECUTE
            </button>
        )}

        {!isLoading && hasHistory && !input.trim() && (
            <button
                onClick={() => onRegenerate?.(isCompare)}
                className="h-10 w-10 flex items-center justify-center border border-white/20 text-white/50 hover:text-white hover:border-white hover:bg-white/10 transition-all rounded-sm"
                title="Regenerate Last Response"
            >
                <i className="fa-solid fa-rotate-right"></i>
            </button>
        )}

        <button
            onClick={() => fileInputRef.current?.click()}
            className="h-10 w-10 flex items-center justify-center border border-white/20 text-white/50 hover:text-white hover:border-white hover:bg-white/10 transition-all rounded-sm"
            title="Attach PDF or Image"
        >
            <i className="fa-solid fa-paperclip"></i>
        </button>
        <input 
            type="file"
            multiple
            ref={fileInputRef}
            onChange={handleFileChange}
            className="hidden"
            accept="image/*,application/pdf"
        />
        
        <button
          onClick={() => setIsCompare(!isCompare)}
          className={`h-10 border transition-all uppercase text-[10px] tracking-widest px-3 font-bold flex items-center justify-center gap-2
            ${isCompare 
              ? 'bg-cyan-900/50 text-cyan-400 border-cyan-400 shadow-[0_0_10px_rgba(34,211,238,0.2)]' 
              : 'bg-black text-white/40 border-white/20 hover:text-white hover:border-white'}`}
          title="Compare Mode (Generate two responses)"
        >
          <i className="fa-solid fa-code-compare text-xs"></i>
          <span className="hidden md:inline">COMPARE</span>
        </button>

      </div>
    </div>
  );
};

export default InputArea;
