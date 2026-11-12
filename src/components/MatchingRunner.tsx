import React, { useState, useEffect } from 'react';
import { MatchingPair } from '../types/course';
import { ArrowUp, ArrowDown, CheckCircle2, XCircle, ArrowRightLeft, Sparkles } from 'lucide-react';

interface MatchingRunnerProps {
  pairs: MatchingPair[];
  checked: boolean;
  onCheckStateChange: (isAllCorrect: boolean, correctCount: number) => void;
  hintTrigger: number;
}

interface AnswerSlot {
  origIdx: number;
  text: string;
}

export const MatchingRunner: React.FC<MatchingRunnerProps> = ({
  pairs,
  checked,
  onCheckStateChange,
  hintTrigger
}) => {
  // Scramble answers initially
  const [answers, setAnswers] = useState<AnswerSlot[]>(() => {
    const list: AnswerSlot[] = pairs.map((p, idx) => ({ origIdx: idx, text: p.correctAnswer }));
    if (list.length > 1) {
      return [...list.slice(1), list[0]];
    }
    return list;
  });

  // Re-sync when pairs change
  useEffect(() => {
    const list: AnswerSlot[] = pairs.map((p, idx) => ({ origIdx: idx, text: p.correctAnswer }));
    if (list.length > 1) {
      setAnswers([...list.slice(1), list[0]]);
    } else {
      setAnswers(list);
    }
  }, [pairs]);

  // Hint: puts the first mismatched answer into its correct slot
  useEffect(() => {
    if (hintTrigger === 0) return;
    setAnswers(prev => {
      const next = [...prev];
      for (let slot = 0; slot < pairs.length; slot++) {
        if (next[slot].text !== pairs[slot].correctAnswer) {
          const targetIdx = next.findIndex((item, i) => i > slot && item.text === pairs[slot].correctAnswer);
          if (targetIdx !== -1) {
            const temp = next[slot];
            next[slot] = next[targetIdx];
            next[targetIdx] = temp;
          }
          break;
        }
      }
      return next;
    });
  }, [hintTrigger, pairs]);

  const moveUp = (idx: number) => {
    if (idx <= 0) return;
    setAnswers(prev => {
      const next = [...prev];
      const temp = next[idx];
      next[idx] = next[idx - 1];
      next[idx - 1] = temp;
      return next;
    });
  };

  const moveDown = (idx: number) => {
    if (idx >= answers.length - 1) return;
    setAnswers(prev => {
      const next = [...prev];
      const temp = next[idx];
      next[idx] = next[idx + 1];
      next[idx + 1] = temp;
      return next;
    });
  };

  const handleSelectAnswer = (slotIdx: number, selectedText: string) => {
    setAnswers(prev => {
      const next = [...prev];
      const otherSlot = next.findIndex((item, i) => i !== slotIdx && item.text === selectedText);
      const currentItem = next[slotIdx];
      const selectedItem = next.find(item => item.text === selectedText);

      if (selectedItem && otherSlot !== -1) {
        // Swap slots
        next[slotIdx] = selectedItem;
        next[otherSlot] = currentItem;
      }
      return next;
    });
  };

  // Evaluate correctness
  useEffect(() => {
    let correct = 0;
    answers.forEach((ans, idx) => {
      if (ans.text === pairs[idx].correctAnswer) {
        correct++;
      }
    });
    onCheckStateChange(correct === pairs.length, correct);
  }, [answers, pairs, onCheckStateChange]);

  const allAnswerOptions = pairs.map(p => p.correctAnswer);

  return (
    <div className="mt-6 pt-5 border-t border-slate-200">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
          <span>🔗</span> Corelați întrebările din stânga cu răspunsurile din dreapta:
        </h3>
        <span className="text-xs text-slate-500 font-medium hidden sm:inline">
          (folosiți săgețile ▲ ▼ sau alegeți răspunsul)
        </span>
      </div>

      <div className="space-y-3">
        {pairs.map((pair, idx) => {
          const currentAnswer = answers[idx];
          const isCorrect = checked && currentAnswer?.text === pair.correctAnswer;
          const isWrong = checked && currentAnswer?.text !== pair.correctAnswer;

          return (
            <div
              key={`match-row-${idx}`}
              className={`p-3.5 sm:p-4 rounded-2xl border transition-all ${
                isCorrect
                  ? 'bg-emerald-50/80 border-emerald-300 shadow-2xs'
                  : isWrong
                  ? 'bg-rose-50/80 border-rose-300 shadow-2xs'
                  : 'bg-white border-slate-200 hover:border-slate-300 shadow-2xs'
              }`}
            >
              <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
                {/* Left: Prompt (Question) */}
                <div className="flex-1 p-3 bg-slate-50/90 border border-slate-200/90 rounded-xl flex items-center gap-3">
                  <span className="w-6 h-6 rounded-md bg-blue-100 text-blue-900 font-bold text-xs flex items-center justify-center shrink-0">
                    {idx + 1}
                  </span>
                  <span className="text-sm sm:text-base font-semibold text-slate-900">
                    {pair.prompt}
                  </span>
                </div>

                {/* Center arrow icon */}
                <div className="hidden md:flex items-center justify-center text-slate-400 px-1">
                  <ArrowRightLeft className="w-4 h-4" />
                </div>

                {/* Right: Answer Card with Controls */}
                <div className={`flex-1 p-3 rounded-xl border flex items-center justify-between gap-2 transition-all ${
                  isCorrect
                    ? 'bg-emerald-100/90 border-emerald-400 text-emerald-950 font-bold'
                    : isWrong
                    ? 'bg-rose-100/80 border-rose-400 text-rose-950 font-medium'
                    : 'bg-white border-blue-200 shadow-2xs text-slate-800'
                }`}>
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <span className="text-sm sm:text-base font-medium truncate">
                      {currentAnswer?.text}
                    </span>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    {checked && (
                      <span className="mr-1">
                        {isCorrect ? (
                          <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                        ) : (
                          <XCircle className="w-5 h-5 text-rose-600" />
                        )}
                      </span>
                    )}

                    {/* Quick Move Arrows */}
                    <button
                      type="button"
                      onClick={() => moveUp(idx)}
                      disabled={idx === 0}
                      className={`p-1.5 rounded-lg border transition-all ${
                        idx === 0
                          ? 'border-slate-100 text-slate-300 cursor-not-allowed'
                          : 'border-slate-200 bg-white hover:bg-slate-100 text-slate-700 active:scale-95'
                      }`}
                      title="Mută mai sus"
                    >
                      <ArrowUp className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => moveDown(idx)}
                      disabled={idx === answers.length - 1}
                      className={`p-1.5 rounded-lg border transition-all ${
                        idx === answers.length - 1
                          ? 'border-slate-100 text-slate-300 cursor-not-allowed'
                          : 'border-slate-200 bg-white hover:bg-slate-100 text-slate-700 active:scale-95'
                      }`}
                      title="Mută mai jos"
                    >
                      <ArrowDown className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

