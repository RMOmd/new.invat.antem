import React from 'react';
import { QuizQuestion } from '../types/course';
import { CheckCircle2, XCircle, HelpCircle } from 'lucide-react';

interface QuizRunnerProps {
  questions: QuizQuestion[];
  selectedAnswers: Record<number, number>;
  onSelectAnswer: (qId: number, ansIdx: number) => void;
  checked: boolean;
}

export const QuizRunner: React.FC<QuizRunnerProps> = ({
  questions,
  selectedAnswers,
  onSelectAnswer,
  checked
}) => {
  return (
    <div className="mt-6 pt-5 border-t border-slate-200 space-y-6">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
          <span>📝</span> Răspundeți la întrebări:
        </h3>
        <span className="text-xs text-slate-500 font-medium">
          {questions.length} întrebări
        </span>
      </div>

      <div className="space-y-4">
        {questions.map((q, qIndex) => {
          const selectedAnsIdx = selectedAnswers[q.id];
          const hasSelected = selectedAnsIdx !== undefined;
          const selectedOption = hasSelected ? q.options.find(o => o.ansIdx === selectedAnsIdx) : null;
          const isCorrect = checked && selectedOption?.isCorrect;
          const isWrong = checked && hasSelected && !selectedOption?.isCorrect;

          return (
            <div
              key={`quiz-q-${q.id}`}
              className={`p-4 sm:p-5 rounded-2xl border transition-all ${
                isCorrect
                  ? 'bg-emerald-50/70 border-emerald-300 shadow-2xs'
                  : isWrong
                  ? 'bg-rose-50/70 border-rose-300 shadow-2xs'
                  : 'bg-white border-slate-200 hover:border-slate-300 shadow-2xs'
              }`}
            >
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex items-start gap-2.5">
                  <span className={`w-7 h-7 rounded-lg text-xs font-bold flex items-center justify-center shrink-0 mt-0.5 ${
                    isCorrect
                      ? 'bg-emerald-200 text-emerald-900'
                      : isWrong
                      ? 'bg-rose-200 text-rose-900'
                      : 'bg-blue-100 text-blue-900'
                  }`}>
                    {qIndex + 1}
                  </span>
                  <h4 className="text-base sm:text-lg font-semibold text-slate-900 leading-snug">
                    {q.question}
                  </h4>
                </div>

                {checked && (
                  <div className="shrink-0">
                    {isCorrect ? (
                      <span className="flex items-center gap-1 text-xs font-bold text-emerald-700 bg-emerald-100 px-2.5 py-1 rounded-full">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        Corect
                      </span>
                    ) : isWrong ? (
                      <span className="flex items-center gap-1 text-xs font-bold text-rose-700 bg-rose-100 px-2.5 py-1 rounded-full">
                        <XCircle className="w-4 h-4 text-rose-600" />
                        Incorect
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-xs font-bold text-amber-700 bg-amber-100 px-2.5 py-1 rounded-full">
                        <HelpCircle className="w-4 h-4 text-amber-600" />
                        Fără răspuns
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Options list */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                {q.options.map(opt => {
                  const isThisSelected = selectedAnsIdx === opt.ansIdx;
                  let btnStyle = 'border-slate-200 bg-slate-50/50 hover:bg-slate-100 text-slate-800';

                  if (isThisSelected) {
                    if (checked) {
                      btnStyle = opt.isCorrect
                        ? 'border-emerald-500 bg-emerald-100 text-emerald-950 font-bold ring-2 ring-emerald-400'
                        : 'border-rose-500 bg-rose-100 text-rose-950 font-bold ring-2 ring-rose-400';
                    } else {
                      btnStyle = 'border-blue-500 bg-blue-50 text-blue-950 font-bold ring-2 ring-blue-300';
                    }
                  } else if (checked && opt.isCorrect && isWrong) {
                    // Show correct answer hint if user picked wrong
                    btnStyle = 'border-emerald-400 bg-emerald-50 text-emerald-900 border-dashed';
                  }

                  return (
                    <button
                      key={`q-${q.id}-opt-${opt.ansIdx}`}
                      type="button"
                      onClick={() => onSelectAnswer(q.id, opt.ansIdx)}
                      className={`w-full p-3.5 rounded-xl border text-left text-sm sm:text-base transition-all flex items-center justify-between gap-2 active:scale-98 ${btnStyle}`}
                    >
                      <span>{opt.text}</span>
                      <span className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 ${
                        isThisSelected
                          ? 'border-current bg-current'
                          : 'border-slate-300 bg-white'
                      }`}>
                        {isThisSelected && (
                          <span className="w-2 h-2 rounded-full bg-white" />
                        )}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

