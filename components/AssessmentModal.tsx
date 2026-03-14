
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

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/95 backdrop-blur-md p-4 animate-in fade-in">
      <div className="w-full max-w-2xl h-[85vh] border border-white/20 bg-black p-8 rounded relative shadow-2xl shadow-white/5 flex flex-col">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-cyan-500/50 to-transparent"></div>
        
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl text-white font-bold tracking-widest uppercase flex items-center gap-2">
            <i className="fa-solid fa-clipboard-check text-cyan-400 text-lg"></i> Assessment: {topic}
          </h2>
          <button onClick={onClose} className="text-white/50 hover:text-white">
            <i className="fa-solid fa-times"></i>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto pr-2 no-scrollbar">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-full text-white/50 gap-4">
              <i className="fa-solid fa-circle-notch animate-spin text-2xl text-cyan-400"></i>
              <div className="text-xs tracking-widest uppercase">Generating Neural Assessment...</div>
            </div>
          ) : questions.length === 0 ? (
            <div className="flex items-center justify-center h-full text-white/30 text-xs tracking-widest uppercase">
              Failed to generate quiz. Please try again.
            </div>
          ) : (
            <div className="space-y-8 pb-8">
              {questions.map((q, idx) => {
                const isCorrect = submitted && answers[q.id] === q.correctAnswerIndex;
                const isWrong = submitted && answers[q.id] !== q.correctAnswerIndex && answers[q.id] !== undefined;

                return (
                  <div key={q.id} className="animate-in fade-in slide-in-right" style={{ animationDelay: `${idx * 100}ms` }}>
                    <div className="text-white font-bold mb-4 text-sm md:text-base flex gap-3">
                      <span className="text-cyan-500">{idx + 1}.</span>
                      {q.question}
                    </div>
                    
                    <div className="space-y-2 pl-6">
                      {q.options.map((opt, optIdx) => {
                        const isSelected = answers[q.id] === optIdx;
                        let optionClass = "border-white/10 hover:border-white/50 text-white/70";
                        
                        if (submitted) {
                           if (optIdx === q.correctAnswerIndex) {
                               optionClass = "border-emerald-500 bg-emerald-500/10 text-emerald-400";
                           } else if (isSelected) {
                               optionClass = "border-red-500 bg-red-500/10 text-red-400";
                           } else {
                               optionClass = "border-white/5 text-white/30 opacity-50";
                           }
                        } else if (isSelected) {
                           optionClass = "border-cyan-400 bg-cyan-900/20 text-cyan-400";
                        }

                        return (
                          <div 
                            key={optIdx}
                            onClick={() => handleSelect(q.id, optIdx)}
                            className={`border p-3 rounded-sm text-sm cursor-pointer transition-all flex items-center gap-3 ${optionClass}`}
                          >
                            <div className={`w-3 h-3 rounded-full border flex items-center justify-center ${
                                isSelected || (submitted && optIdx === q.correctAnswerIndex) ? 'border-current' : 'border-white/30'
                            }`}>
                                {(isSelected || (submitted && optIdx === q.correctAnswerIndex)) && <div className="w-1.5 h-1.5 rounded-full bg-current"></div>}
                            </div>
                            {opt}
                          </div>
                        );
                      })}
                    </div>

                    {submitted && (
                       <div className="mt-4 ml-6 p-4 bg-white/5 border border-white/10 rounded-sm text-xs text-white/80 leading-relaxed">
                          <strong className="text-white/50 uppercase tracking-wider block mb-1">Explanation:</strong>
                          {q.explanation}
                       </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="pt-6 border-t border-white/10 flex justify-between items-center">
            {submitted ? (
                <div className="text-lg font-bold uppercase tracking-widest">
                    Score: <span className={score >= questions.length * 0.6 ? 'text-emerald-400' : 'text-red-400'}>{score} / {questions.length}</span>
                </div>
            ) : (
                <div className="text-xs text-white/30 uppercase tracking-widest">
                   {Object.keys(answers).length} / {questions.length} Answered
                </div>
            )}

            {!submitted && !loading && questions.length > 0 && (
                <button 
                    onClick={handleSubmit}
                    disabled={Object.keys(answers).length < questions.length}
                    className="bg-cyan-600 text-white hover:bg-cyan-500 transition-colors px-6 py-2 uppercase text-xs tracking-widest font-bold disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    Submit Assessment
                </button>
            )}
             {submitted && (
                <button 
                    onClick={onClose}
                    className="border border-white/20 text-white hover:bg-white hover:text-black transition-colors px-6 py-2 uppercase text-xs tracking-widest font-bold"
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
