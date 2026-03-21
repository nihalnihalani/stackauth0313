import React, { useMemo } from 'react';
import DOMPurify from 'dompurify';

interface SvgModalProps {
  content: string;
  onClose: () => void;
}

const SvgModal: React.FC<SvgModalProps> = ({ content, onClose }) => {
  const sanitizedContent = useMemo(() => {
    return DOMPurify.sanitize(content, {
      USE_PROFILES: { svg: true, svgFilters: true },
      ADD_TAGS: ['use'],
      FORBID_TAGS: ['script', 'foreignObject', 'iframe', 'object', 'embed'],
      FORBID_ATTR: ['onload', 'onerror', 'onclick', 'onmouseover', 'onfocus', 'onblur', 'onsubmit', 'onreset', 'onchange', 'oninput'],
    });
  }, [content]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--surface)]/80 backdrop-blur-[16px] p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="relative w-full h-full max-w-[95vw] max-h-[95vh] border border-[var(--primary-container)]/30 bg-[var(--surface-container-lowest)] glow-cyan-strong flex items-center justify-center p-8 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-50 flex items-center gap-2 text-[var(--on-surface-variant)] hover:text-[var(--on-surface)] transition-colors bg-[var(--surface-container)] border border-[var(--outline-variant)] px-3 py-1 uppercase text-xs tracking-widest font-headline"
        >
          <span>Close View</span>
        </button>
        <div
          className="w-full h-full flex items-center justify-center [&>svg]:w-full [&>svg]:h-full [&>svg]:max-w-full [&>svg]:max-h-full"
          dangerouslySetInnerHTML={{ __html: sanitizedContent }}
        />
        <div className="absolute bottom-4 left-8 label-sm text-[var(--outline)] select-none">
          FULL_SCALE_RENDERING
        </div>
      </div>
    </div>
  );
};

export default SvgModal;
