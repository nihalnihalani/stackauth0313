
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
    <div className="fixed bottom-0 left-0 w-full bg-[var(--surface-container-lowest)] border-t-2 border-[var(--outline-variant)]/20 z-10">

      {/* Attachment Preview Bar */}
      {attachments.length > 0 && (
          <div className="w-full px-4 py-2 bg-[var(--surface-container)] border-b border-[var(--outline-variant)]/20 flex gap-4 overflow-x-auto no-scrollbar">
              {attachments.map((att, i) => (
                  <div key={i} className="relative group flex-shrink-0 animate-in fade-in slide-in-bottom duration-300">
                      {att.type === 'image' ? (
                          <div className="h-16 w-16 rounded-none border border-[var(--outline-variant)]/20 overflow-hidden bg-[var(--surface-container)]">
                             <img src={`data:${att.mimeType};base64,${att.data}`} alt="preview" className="h-full w-full object-cover opacity-70 group-hover:opacity-100 transition-opacity" />
                          </div>
                      ) : (
                          <div className="h-16 w-16 rounded-none border border-[var(--outline-variant)]/20 bg-[var(--surface-container)] flex flex-col items-center justify-center text-[var(--on-surface-variant)] group-hover:text-[var(--primary-container)] transition-colors">
                              <i className="fa-solid fa-file-pdf text-xl mb-1"></i>
                              <span className="text-[8px] uppercase tracking-widest max-w-full truncate px-1">{att.mimeType.split('/')[1]}</span>
                          </div>
                      )}
                      <button
                        onClick={() => removeAttachment(i)}
                        className="absolute -top-2 -right-2 bg-[var(--error-container)] hover:bg-[var(--error)] text-[var(--on-error)] rounded-none w-5 h-5 flex items-center justify-center text-[10px] border border-[var(--outline-variant)]/20 transition-colors"
                      >
                          <i className="fa-solid fa-times"></i>
                      </button>
                  </div>
              ))}
          </div>
      )}

      <div className="max-w-5xl mx-auto px-4 md:px-6 py-3 md:py-4">
        <div className="relative bg-[var(--surface-container-lowest)] border-b-2 border-[var(--outline-variant)] flex items-end focus-within:border-[var(--primary-container)] transition-colors">
          {/* Mode indicator */}
          <div className="p-4 font-headline text-lg font-bold text-[var(--primary-container)] select-none">
            {mode === MODES.SOCRATIC ? '?' : '>'}
          </div>

          <form onSubmit={onSubmit} className="flex-1">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={mode === MODES.SOCRATIC ? "ENTER RESPONSE..." : "ENTER SECURE COMMAND OR QUERY..."}
              className="nexus-input w-full h-10 bg-transparent border-none focus:ring-0 outline-none text-[var(--primary)] font-mono text-sm px-2 placeholder:text-[var(--outline)]/40 uppercase"
              style={{ borderBottom: 'none', paddingLeft: '0.5rem' }}
              autoFocus
            />
          </form>

          <div className="p-2 flex items-center gap-2">
            {/* Attach */}
            <button
                onClick={() => fileInputRef.current?.click()}
                className="h-10 w-10 flex items-center justify-center bg-[var(--surface-container)] border border-[var(--outline-variant)]/20 text-[var(--on-surface-variant)] hover:brightness-110 hover:text-[var(--primary-container)] transition-all rounded-none"
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

            {/* Regenerate */}
            {!isLoading && hasHistory && !input.trim() && (
                <button
                    onClick={() => onRegenerate?.(isCompare)}
                    className="h-10 w-10 flex items-center justify-center bg-[var(--surface-container)] border border-[var(--outline-variant)]/20 text-[var(--on-surface-variant)] hover:brightness-110 hover:text-[var(--primary-container)] transition-all rounded-none"
                    title="Regenerate Last Response"
                >
                    <i className="fa-solid fa-rotate-right"></i>
                </button>
            )}

            {/* Execute / Stop */}
            {isLoading ? (
                <button
                  onClick={onStop}
                  className="h-10 px-6 bg-[var(--error-container)] text-[var(--error)] clipped-button label-sm hover:brightness-110 transition-all flex items-center justify-center whitespace-nowrap animate-pulse"
                >
                  STOP
                </button>
            ) : (
                <button
                  onClick={() => onSubmit()}
                  disabled={(!input.trim() && attachments.length === 0)}
                  className="nexus-btn-primary clipped-button h-10 px-6 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center whitespace-nowrap"
                >
                  EXECUTE
                </button>
            )}
          </div>
        </div>

        {/* Bottom controls row */}
        <div className="flex items-center justify-between mt-2 px-1">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 ${mode === MODES.SOCRATIC ? 'bg-[var(--secondary)]' : 'bg-[var(--tertiary-container)]'} shadow-[0_0_8px_${mode === MODES.SOCRATIC ? 'var(--secondary)' : 'var(--tertiary-container)'}]`}></span>
              <span className="label-sm text-[var(--on-surface-variant)]">
                {mode === MODES.SOCRATIC ? 'SOCRATIC_PROTOCOL' : 'DIRECT_MODE'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Compare Toggle */}
            <button
              onClick={() => setIsCompare(!isCompare)}
              className={`h-8 border transition-all label-sm px-3 flex items-center justify-center gap-2 rounded-none
                ${isCompare
                  ? 'bg-[var(--primary-container)] text-[var(--on-primary)] border-[var(--primary-container)] glow-cyan'
                  : 'bg-[var(--surface-container)] text-[var(--on-surface-variant)] border-[var(--outline-variant)]/20 hover:brightness-110'}`}
              title="Compare Mode (Generate two responses)"
            >
              <i className="fa-solid fa-code-compare text-xs"></i>
              <span className="hidden md:inline">COMPARE</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default InputArea;
