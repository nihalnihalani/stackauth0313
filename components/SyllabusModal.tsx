
import React, { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getNotes, getSyllabus, saveSyllabus } from '../services/dbService';
import { generateSyllabus } from '../services/llmService';
import { AppConfig, Note } from '../types';
import MarkdownRenderer from './MarkdownRenderer';
import AssessmentModal from './AssessmentModal';

type GetAccessToken = () => Promise<string | null>;

interface SyllabusModalProps {
  username: string;
  onClose: () => void;
  config: AppConfig;
  onSvgClick: (svgContent: string) => void;
  onFork: (topicTitle: string) => void;
  getToken: GetAccessToken;
}

interface SyllabusData {
  title: string;
  modules: Module[];
}

interface Module {
  title: string;
  topics: Topic[];
}

interface Topic {
  title: string;
  subtopics: string[];
}

const SyllabusModal: React.FC<SyllabusModalProps> = ({ username, onClose, config, onSvgClick, onFork, getToken }) => {
  const queryClient = useQueryClient();
  const [rawContent, setRawContent] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [parsedData, setParsedData] = useState<SyllabusData | null>(null);
  const [assessTopic, setAssessTopic] = useState<string | null>(null);

  const { data: notes = [] } = useQuery({
    queryKey: ['notes', username],
    queryFn: () => getNotes(username),
    refetchOnMount: true
  });

  const { data: savedSyllabus, isLoading: isLoadingSyllabus } = useQuery({
    queryKey: ['syllabus', username],
    queryFn: () => getSyllabus(username),
    refetchOnMount: true
  });

  const saveMutation = useMutation({
    mutationFn: async ({ content, count }: { content: string, count: number }) => {
       saveSyllabus(content, count, username);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['syllabus', username] });
    }
  });

  /**
   * Robust JSON Extractor:
   * Attempts to find JSON within a string even if wrapped in markdown or surrounded by text.
   */
  const extractJson = (text: string) => {
    if (!text) return null;

    // 1. Try finding markdown code blocks first (Most reliable if present)
    const codeBlockRegex = /```(?:json)?\s*([\s\S]*?)\s*```/;
    const match = codeBlockRegex.exec(text);
    if (match) {
      try { return JSON.parse(match[1]); } catch(e) {}
    }

    // 2. Try finding the first '{' and last '}' to isolate JSON object
    const firstBrace = text.indexOf('{');
    const lastBrace = text.lastIndexOf('}');

    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      const potentialJson = text.substring(firstBrace, lastBrace + 1);
      try { return JSON.parse(potentialJson); } catch(e) {}
    }

    // 3. Last ditch: Direct parse attempt
    try { return JSON.parse(text); } catch(e) {}

    return null;
  };

  const handleGenerate = async (existingJson?: string) => {
    setIsGenerating(true);
    setRawContent('');
    setParsedData(null);

    let buffer = '';

    try {
      await generateSyllabus(getToken, config, notes, (chunk) => {
        buffer += chunk;
        setRawContent(prev => prev + chunk);
      }, existingJson);

      // Attempt Final Parse and Save
      const data = extractJson(buffer);
      if (data && data.modules) {
         setParsedData(data);
         // Save to DB (Store as stringified JSON to keep consistent)
         saveMutation.mutate({ content: JSON.stringify(data), count: notes.length });
      }

    } catch (e) {
      setRawContent("ERROR: UNABLE TO SYNTHESIZE SYLLABUS FROM ARCHIVES.");
    } finally {
      setIsGenerating(false);
    }
  };

  useEffect(() => {
    // Wait for data to load
    if (notes.length === 0 || isLoadingSyllabus) return;

    if (!savedSyllabus) {
        // No existing syllabus: Generate New
        if (!isGenerating && !parsedData && !rawContent) {
           handleGenerate();
        }
    } else {
        // Existing syllabus: Check if update needed
        if (notes.length > (savedSyllabus.noteCount || 0)) {
             // New notes added: Update existing structure
             if (!isGenerating && !parsedData && !rawContent) {
                 handleGenerate(savedSyllabus.content);
             }
        } else {
             // Up to date: Load from cache
             if (!parsedData && !isGenerating && !rawContent) {
                 try {
                     const data = JSON.parse(savedSyllabus.content);
                     setParsedData(data);
                 } catch (e) {
                     // Corrupt cache? Regenerate
                     handleGenerate();
                 }
             }
        }
    }
  }, [notes.length, savedSyllabus, isLoadingSyllabus]);

  // Optimistic UI: Try parsing while streaming
  useEffect(() => {
    if (!rawContent || !isGenerating) return;
    const data = extractJson(rawContent);
    if (data && data.modules) {
      setParsedData(data);
    }
  }, [rawContent, isGenerating]);

  // Fallback to text if generation is done but parsing failed
  const showFallback = !isGenerating && !parsedData && rawContent;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--surface)]/80 backdrop-blur-[12px] p-4">
      <div className="w-full max-w-4xl h-[85vh] bg-[var(--surface-container-lowest)] border border-[var(--primary-container)]/30 shadow-[0_0_100px_rgba(0,243,255,0.1)] relative overflow-hidden flex flex-col">
        {/* Header */}
        <div className="nexus-modal-header">
          <span className="font-headline font-black uppercase text-xs tracking-[0.15em] text-[var(--primary-container)]">CURRICULUM_MATRIX</span>
          <button
            onClick={onClose}
            className="bg-[var(--surface-container)] border border-[var(--outline-variant)] text-[var(--on-surface-variant)] hover:text-[var(--primary-container)] transition-colors w-8 h-8 flex items-center justify-center"
          >
            <i className="fa-solid fa-times text-xs"></i>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 mb-4">

           {(isGenerating && !parsedData) || isLoadingSyllabus ? (
             <div className="flex flex-col items-center justify-center h-full text-[var(--outline)] gap-4">
                <i className="fa-solid fa-circle-notch animate-spin text-2xl text-[var(--primary-container)]"></i>
                <div className="text-xs tracking-widest uppercase font-headline">
                    {isLoadingSyllabus ? 'Loading Archives...' : 'Synthesizing Syllabus Structure...'}
                </div>
             </div>
           ) : null}

           {parsedData && !isLoadingSyllabus && (
             <div className="space-y-8">
                <div className="text-center border-b border-[var(--outline-variant)]/20 pb-4 mb-8">
                  <h1 className="text-2xl font-bold uppercase tracking-[0.2em] text-[var(--primary)] font-headline">{parsedData.title}</h1>
                  <div className="label-sm text-[var(--outline)] mt-2">
                     Generated from {notes.length} Neural Archives
                     {savedSyllabus && notes.length === savedSyllabus.noteCount ? ' [CACHED]' : ' [UPDATING...]'}
                  </div>
                </div>

                {parsedData.modules?.map((mod, mIdx) => (
                  <ModuleItem
                    key={mIdx}
                    module={mod}
                    index={mIdx}
                    onFork={onFork}
                    onAssess={setAssessTopic}
                  />
                ))}
             </div>
           )}

           {showFallback && (
             <div className="text-[var(--primary)] text-sm md:text-base leading-relaxed">
               <div className="text-[var(--error)] text-xs uppercase tracking-widest mb-4 font-headline">Structure Parsing Failed. Reverting to Raw Stream.</div>
               <MarkdownRenderer content={rawContent} onSvgClick={onSvgClick} />
             </div>
           )}

           {!isGenerating && !parsedData && !rawContent && !isLoadingSyllabus && (
              <div className="flex items-center justify-center h-full text-[var(--outline)] tracking-widest text-xs font-headline uppercase">
                 NO DATA AVAILABLE.
              </div>
           )}
        </div>

        <div className="px-6 pb-4 flex justify-end gap-4 border-t border-[var(--primary-container)]/20 pt-4">
            <button
                onClick={() => handleGenerate()}
                disabled={isGenerating || notes.length === 0}
                className="nexus-btn-secondary flex items-center gap-2 disabled:opacity-50"
            >
                <i className="fa-solid fa-rotate"></i> Re-Analyze
            </button>
        </div>
      </div>

      {assessTopic && (
        <AssessmentModal
          topic={assessTopic}
          notes={notes}
          config={config}
          onClose={() => setAssessTopic(null)}
          getToken={getToken}
        />
      )}
    </div>
  );
};

const ModuleItem: React.FC<{
    module: Module,
    index: number,
    onFork: (title: string) => void,
    onAssess: (title: string) => void
}> = ({ module, index, onFork, onAssess }) => {
  const [expanded, setExpanded] = useState(true);

  return (
    <div className="mb-6">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-4 text-left group bg-[var(--surface-container)] border-l-[3px] border-l-[var(--primary-container)] p-4 hover:bg-[var(--surface-container-high)] transition-colors"
      >
        <div className="text-[var(--primary-container)] font-headline font-bold text-lg">
          {String(index + 1).padStart(2, '0')}
        </div>
        <div className="flex-1">
          <h3 className="text-[var(--on-surface)] font-headline font-semibold uppercase tracking-wider text-sm md:text-base">{module.title}</h3>
        </div>
        <i className={`fa-solid fa-chevron-down text-[var(--outline)] transition-transform ${expanded ? 'rotate-180' : ''}`}></i>
      </button>

      {expanded && (
        <div className="pl-10 mt-4 space-y-4 border-l border-[var(--outline-variant)] ml-2.5">
          {module.topics?.map((topic, tIdx) => (
            <div key={tIdx} className="relative group/topic">
              {/* Connector line */}
              <div className="absolute -left-[31px] top-3 w-6 h-[1px] bg-[var(--outline-variant)]"></div>

              <h4
                className="nexus-list-item text-[var(--on-surface)] hover:text-[var(--primary-container)] font-headline font-bold text-xs tracking-wider mb-2 cursor-pointer transition-colors"
                onClick={() => onFork(topic.title)}
                title="Start a new session on this topic"
              >
                <span className="w-1.5 h-1.5 bg-[var(--primary-container)]/50 group-hover/topic:bg-[var(--primary-container)] flex-shrink-0"></span>
                {topic.title}
                <i className="fa-solid fa-code-branch opacity-0 group-hover/topic:opacity-100 text-[9px] text-[var(--outline)] ml-2"></i>
              </h4>
              <ul className="pl-8 space-y-2">
                {(topic.subtopics || []).map((sub, sIdx) => (
                  <li
                    key={sIdx}
                    className="flex items-center justify-between group/sub"
                  >
                    <span
                        className="text-[var(--on-surface-variant)] text-xs font-mono hover:text-[var(--primary)] transition-colors cursor-pointer flex-1"
                        onClick={() => onFork(sub)}
                        title="Start a new session on this sub-topic"
                    >
                      <span className="text-[var(--outline-variant)] mr-2">{'>'}</span>{sub}
                    </span>
                    <button
                        onClick={() => onAssess(sub)}
                        className="text-[var(--secondary-container)] hover:text-[var(--secondary)] transition-colors px-2 py-0.5"
                        title="Take Assessment"
                    >
                        <i className="fa-solid fa-bullseye text-[12px]"></i>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default SyllabusModal;
