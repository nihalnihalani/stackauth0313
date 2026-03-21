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
        <div className="label-sm bg-[var(--surface-container-high)] border border-[var(--outline-variant)]/20 px-2 py-0.5 text-[var(--on-surface-variant)] hidden md:block">
           {className?.replace('language-', '') || 'TEXT'}
        </div>
        <button
          onClick={handleCopy}
          className="label-sm bg-[var(--surface-container-high)] border border-[var(--outline-variant)]/20 hover:border-[var(--primary-container)]/40 hover:text-[var(--primary-container)] text-[var(--on-surface-variant)] px-3 py-0.5 transition-all flex items-center gap-2"
          title="Copy to clipboard"
        >
          {copied ? (
             <><i className="fa-solid fa-check text-[var(--tertiary-container)]"></i> <span className="text-[var(--tertiary-container)]">COPIED</span></>
          ) : (
             <><i className="fa-regular fa-copy"></i> COPY</>
          )}
        </button>
      </div>
      <div className="nexus-code-block w-full overflow-x-auto pt-6 md:pt-4 no-scrollbar rounded-none">
        <code className={`${className} font-mono text-sm whitespace-pre`} {...props}>
          {children}
        </code>
      </div>
    </div>
  );
};

export default CodeBlock;
