
import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import remarkGfm from 'remark-gfm';
import rehypeKatex from 'rehype-katex';
import DOMPurify from 'dompurify';
import CodeBlock from './CodeBlock';

interface MarkdownRendererProps {
  content: string;
  onSvgClick: (svgContent: string) => void;
}

const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content, onSvgClick }) => {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkMath, remarkGfm]}
      rehypePlugins={[[rehypeKatex, { strict: false, trust: true }]]}
      components={{
        code: ({ node, inline, className, children, ...props }: any) => {
          const match = /language-(\w+)/.exec(className || '');
          const isSvg = !inline && match && match[1] === 'svg';

          if (isSvg) {
            const svgContent = String(children);
            return (
              <div
                className="my-6 border border-white/20 bg-black/50 p-2 rounded-sm relative overflow-hidden group cursor-pointer hover:border-white/60 transition-colors"
                onClick={() => onSvgClick(svgContent)}
                title="Click to expand schematic"
              >
                <div className="absolute top-0 right-0 p-1 text-[8px] text-white/40 border-b border-l border-white/10 uppercase tracking-widest bg-white/5 group-hover:text-white group-hover:bg-white/10 transition-colors z-10">
                  Schematic_Render [EXPAND]
                </div>
                {/* 
                   Force SVG to be responsive. 
                   w-full: takes full width of container.
                   h-auto: maintains aspect ratio.
                   max-h: prevents it from being excessively tall on mobile.
                */}
                <div
                  className="w-full flex justify-center items-center [&>svg]:w-full [&>svg]:h-auto [&>svg]:max-h-[600px] [&>svg]:block"
                  dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(svgContent, {
                    USE_PROFILES: { svg: true, svgFilters: true },
                    ADD_TAGS: ['use'],
                    FORBID_TAGS: ['script', 'foreignObject', 'iframe', 'object', 'embed'],
                    FORBID_ATTR: ['onload', 'onerror', 'onclick', 'onmouseover', 'onfocus', 'onblur', 'onsubmit', 'onreset', 'onchange', 'oninput'],
                  }) }}
                />
              </div>
            );
          }

          if (!inline) {
            return <CodeBlock className={className} {...props}>{children}</CodeBlock>;
          }

          return <code className="bg-white/10 px-1 rounded break-all" {...props}>{children}</code>;
        },
        pre: ({ node, children }) => <>{children}</>,
        table: ({ node, children }) => (
          <div className="overflow-x-auto my-6 border border-white/10 rounded-sm">
            <table className="w-full text-left border-collapse text-sm">{children}</table>
          </div>
        ),
        thead: ({ node, children }) => (
          <thead className="bg-white/10 text-white uppercase tracking-wider font-bold">{children}</thead>
        ),
        tbody: ({ node, children }) => (
          <tbody className="divide-y divide-white/10">{children}</tbody>
        ),
        tr: ({ node, children }) => (
          <tr className="hover:bg-white/5 transition-colors">{children}</tr>
        ),
        th: ({ node, children }) => (
          <th className="px-4 py-3 border-b border-white/20 whitespace-nowrap">{children}</th>
        ),
        td: ({ node, children }) => (
          <td className="px-4 py-3 border-r border-white/5 last:border-r-0">{children}</td>
        ),
      }}
    >
      {content}
    </ReactMarkdown>
  );
};

export default MarkdownRenderer;
