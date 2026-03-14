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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 backdrop-blur-md p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="relative w-full h-full max-w-[95vw] max-h-[95vh] border border-white/20 bg-black/50 rounded flex items-center justify-center p-8 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-50 flex items-center gap-2 text-white/60 hover:text-white transition-colors bg-black border border-white/20 px-3 py-1 rounded-sm uppercase text-xs tracking-widest"
        >
          <span>Close View</span>
          <i className="fa-solid fa-xmark text-lg"></i>
        </button>
        <div
          className="w-full h-full flex items-center justify-center [&>svg]:w-full [&>svg]:h-full [&>svg]:max-w-full [&>svg]:max-h-full"
          dangerouslySetInnerHTML={{ __html: sanitizedContent }}
        />
        <div className="absolute bottom-4 left-8 text-[10px] text-white/30 tracking-[0.2em] uppercase select-none">
          Full_Scale_Rendering_Mode
        </div>
      </div>
    </div>
  );
};

export default SvgModal;
