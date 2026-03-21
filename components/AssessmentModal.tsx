
import React, { useState, useEffect } from 'react';
import { AppConfig, Note, QuizQuestion } from '../types';
import { generateAssessment } from '../services/llmService';

type GetAccessToken = () => Promise<string | null>;

interface AssessmentModalProps {
  topic: string;
  notes: Note[];
  config: AppConfig;
  onClose: () => void;
  getToken: GetAccessToken;
}

const AssessmentModal: React.FC<AssessmentModalProps> = ({ topic, notes, config, onClose, getToken }) => {
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [submitted, setSubmitted] = useState(false);
  const [score, setScore] = useState(0);

  useEffect(() => {
    const loadQuiz = async () => {
      setLoading(true);
      let buffer = '';
      try {
        await generateAssessment(getToken, config, topic, notes, (chunk) => {
          buffer += chunk;
        });

        // Robust parsing similar to Syllabus
        const jsonMatch = buffer.match(/\[[\s\S]*\]/);
        const jsonStr = jsonMatch ? jsonMatch[0] : buffer;
        const parsed = JSON.parse(jsonStr);

        if (Array.isArray(parsed)) {
          setQuestions(parsed);
        } else {
          throw new Error("Invalid format");
        }
      } catch (e) {
        console.error("Quiz generation failed", e);
        // Fallback for demo if API fails or parsing fails
        setQuestions([]);
      } finally {
        setLoading(false);
      }
    };

    loadQuiz();
  }, [topic]);

  const handleSelect = (qId: number, optionIdx: number) => {
    if (submitted) return;
    setAnswers(prev => ({ ...prev, [qId]: optionIdx }));
  };

  const handleSubmit = () => {
    let correct = 0;
    questions.forEach(q => {
      if (answers[q.id] === q.correctAnswerIndex) {
        correct++;
      }
    });
    setScore(correct);
    setSubmitted(true);
  };

  const scorePercent = questions.length > 0 ? Math.round((score / questions.length) * 100) : 0;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-[var(--surface)]/80 backdrop-blur-[12px] p-4">
      <div className="w-full max-w-2xl h-[85vh] bg-[var(--surface-container-lowest)] border border-[var(--primary-container)]/30 shadow-[0_0_100px_rgba(0,243,255,0.1)] relative overflow-hidden flex flex-col">
        {/* Header - Magenta / secondary accent */}
        <div className="bg-[var(--secondary)]/10 border-b border-[var(--secondary)]/20 px-6 py-3 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <i className="fa-solid fa-clipboard-check text-[var(--secondary)] animate-pulse"></i>
            <span className="font-headline font-black uppercase text-xs tracking-[0.15em] text-[var(--secondary)]">ASSESSMENT_PROTOCOL</span>
          </div>
          <button
            onClick={onClose}
            className="bg-[var(--surface-container)] border border-[var(--outline-variant)] text-[var(--on-surface-variant)] hover:text-[var(--primary-container)] transition-colors w-8 h-8 flex items-center justify-center"
          >
            <i className="fa-solid fa-times text-xs"></i>
          </button>
        </div>

        {/* Topic badge */}
        <div className="px-6 pt-4 pb-2">
          <span className="nexus-badge-warning">
            <i className="fa-solid fa-bullseye text-[8px]"></i>
            {topic}
          </span>
        </div>

        <div className="flex-1 overflow-y-auto px-6 pb-6">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-full text-[var(--outline)] gap-4">
              <i className="fa-solid fa-circle-notch animate-spin text-2xl text-[var(--secondary)]"></i>
              <div className="text-xs tracking-widest uppercase font-headline">Generating Neural Assessment...</div>
            </div>
          ) : questions.length === 0 ? (
            <div className="flex items-center justify-center h-full text-[var(--outline)] text-xs tracking-widest uppercase font-headline">
              Failed to generate quiz. Please try again.
            </div>
          ) : (
            <div className="space-y-8 pb-8">
              {/* Progress Bar */}
              <div className="w-full h-1 bg-[var(--surface-container-high)] relative mt-2">
                <div
                  className="absolute left-0 top-0 h-full bg-[var(--primary-container)] transition-all duration-300"
                  style={{ width: `${(Object.keys(answers).length / questions.length) * 100}%` }}
                ></div>
                <div className="absolute -right-2 top-4 label-sm text-[var(--primary-container)]">
                  {Object.keys(answers).length} / {questions.length}
                </div>
              </div>

              {questions.map((q, idx) => {
                const isCorrect = submitted && answers[q.id] === q.correctAnswerIndex;
                const isWrong = submitted && answers[q.id] !== q.correctAnswerIndex && answers[q.id] !== undefined;

                return (
                  <div key={q.id} className="mt-6">
                    <div className="text-[var(--primary)] font-headline font-bold mb-4 text-sm md:text-base flex gap-3">
                      <span className="text-[var(--secondary)]">{idx + 1}.</span>
                      {q.question}
                    </div>

                    <div className="space-y-2 pl-6">
                      {q.options.map((opt, optIdx) => {
                        const isSelected = answers[q.id] === optIdx;
                        let optionBg = 'bg-[var(--surface-container)]';
                        let optionBorder = 'border border-[var(--outline-variant)]/20 hover:border-[var(--primary-container)]';
                        let optionText = 'text-[var(--on-surface)]';
                        let indicatorBorder = 'border-[var(--outline)]';

                        if (submitted) {
                           if (optIdx === q.correctAnswerIndex) {
                               optionBg = 'bg-[var(--tertiary-container)]/10';
                               optionBorder = 'border-2 border-[var(--tertiary-container)]';
                               optionText = 'text-[var(--tertiary)]';
                               indicatorBorder = 'border-[var(--tertiary-container)]';
                           } else if (isSelected) {
                               optionBg = 'bg-[var(--error-container)]/10';
                               optionBorder = 'border-2 border-[var(--error)]';
                               optionText = 'text-[var(--error)]';
                               indicatorBorder = 'border-[var(--error)]';
                           } else {
                               optionBg = 'bg-[var(--surface-container)]';
                               optionBorder = 'border border-[var(--outline-variant)]/10';
                               optionText = 'text-[var(--on-surface-variant)] opacity-50';
                           }
                        } else if (isSelected) {
                           optionBg = 'bg-[var(--primary-container)]/5';
                           optionBorder = 'border-2 border-[var(--primary-container)]';
                           optionText = 'text-[var(--primary)]';
                           indicatorBorder = 'border-[var(--primary-container)]';
                        }

                        return (
                          <div
                            key={optIdx}
                            onClick={() => handleSelect(q.id, optIdx)}
                            className={`flex items-center p-4 ${optionBg} ${optionBorder} ${optionText} cursor-pointer transition-all`}
                          >
                            <div className={`w-6 h-6 border-2 ${indicatorBorder} flex items-center justify-center mr-4 flex-shrink-0`}>
                              {isSelected || (submitted && optIdx === q.correctAnswerIndex) ? (
                                <div className="w-3 h-3 bg-current"></div>
                              ) : (
                                <span className="text-[10px] font-headline font-bold">{String.fromCharCode(65 + optIdx)}</span>
                              )}
                            </div>
                            <p className="text-sm font-body">{opt}</p>
                          </div>
                        );
                      })}
                    </div>

                    {submitted && (
                       <div className="mt-4 ml-6 p-4 bg-[var(--surface-container)] border border-[var(--outline-variant)]/20 text-xs text-[var(--on-surface-variant)] leading-relaxed">
                          <strong className="text-[var(--outline)] uppercase tracking-wider block mb-1 font-headline">Explanation:</strong>
                          {q.explanation}
                       </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="px-6 pb-4 pt-4 border-t border-[var(--outline-variant)]/20 flex justify-between items-center">
            {submitted ? (
                <div className="font-headline font-black text-[2rem] uppercase tracking-widest">
                    <span className={scorePercent >= 60 ? 'text-[var(--tertiary-container)]' : 'text-[var(--error)]'}>
                      {scorePercent}%
                    </span>
                    <span className="text-[var(--outline)] text-sm ml-3 font-normal">
                      ({score}/{questions.length})
                    </span>
                </div>
            ) : (
                <div className="label-sm text-[var(--outline)]">
                   {Object.keys(answers).length} / {questions.length} Answered
                </div>
            )}

            {!submitted && !loading && questions.length > 0 && (
                <button
                    onClick={handleSubmit}
                    disabled={Object.keys(answers).length < questions.length}
                    className="nexus-btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    Submit Response
                </button>
            )}
             {submitted && (
                <button
                    onClick={onClose}
                    className="nexus-btn-secondary"
                >
                    Close
                </button>
            )}
        </div>
      </div>
    </div>
  );
};

export default AssessmentModal;
