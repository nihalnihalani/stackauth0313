import React, { useState } from 'react';

const CodeBlock = ({ className, children, ...props }: any) => {
  const [copied, setCopied] = useState(false);
  const textContent = String(children).replace(/\n$/, '');

  const handleCopy = () => {
    navigator.clipboard.writeText(textContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative w-full my-6 group">
      <div className="absolute -top-3 right-0 flex items-center gap-2 z-10">
        <div className="bg-black border border-white/20 px-2 py-0.5 text-[10px] text-white/40 uppercase tracking-widest hidden md:block">
           {className?.replace('language-', '') || 'TEXT'}
        </div>
        <button
          onClick={handleCopy}
          className="bg-black border border-white/20 hover:border-white hover:text-black hover:bg-white text-white/60 px-3 py-0.5 text-[10px] uppercase tracking-widest transition-all flex items-center gap-2"
          title="Copy to clipboard"
        >
          {copied ? (
             <><i className="fa-solid fa-check text-emerald-500"></i> COPIED</>
          ) : (
             <><i className="fa-regular fa-copy"></i> COPY</>
          )}
        </button>
      </div>
      <div className="w-full overflow-x-auto border border-white/10 bg-white/5 p-4 pt-6 md:pt-4 no-scrollbar">
        <code className={`${className} font-mono text-sm whitespace-pre`} {...props}>
          {children}
        </code>
      </div>
    </div>
  );
};

export default CodeBlock;