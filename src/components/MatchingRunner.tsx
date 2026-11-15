import React, { useState, useEffect } from 'react';
import { MatchingPair } from '../types/course';
import { useLanguage } from '../context/LanguageContext';
import { ArrowUp, ArrowDown, CheckCircle2, XCircle, ArrowRightLeft, Sparkles } from 'lucide-react';

interface MatchingRunnerProps {
  pairs: MatchingPair[];
  checked: boolean;
  savedAnswers?: Record<string | number, string>;
  isCompleted?: boolean;
  savedScore?: number;
  onAnswersChange?: (answers: string[]) => void;
  onCheckStateChange: (isAllCorrect: boolean, correctCount: number) => void;
  hintTrigger: number;
}

interface AnswerSlot {
  origIdx: number;
  text: string;
}

const clean = (s: string) => (s || '').trim().replace(/\s+/g, ' ');

const buildInitialAnswers = (
  pairsList: MatchingPair[],
  saved?: Record<string | number, string>,
  isCompleted?: boolean,
  savedScore?: number
): AnswerSlot[] => {
  const defaultList: AnswerSlot[] = pairsList.map((p, idx) => ({ origIdx: idx, text: p.correctAnswer }));

  const hasSavedAnswers = saved && Object.keys(saved).length > 0 && Object.values(saved).some(v => typeof v === 'string' && v.trim().length > 0);

  // 1. If explicit answers are saved, restore them
  if (hasSavedAnswers) {
    const usedIndices = new Set<number>();
    const restored: (AnswerSlot | null)[] = [];

    for (let i = 0; i < pairsList.length; i++) {
      const savedText = saved[i] || saved[String(i)];
      if (savedText) {
        const foundIdx = defaultList.findIndex((item, idx) => !usedIndices.has(idx) && clean(item.text) === clean(savedText));
        if (foundIdx !== -1) {
          restored.push(defaultList[foundIdx]);
          usedIndices.add(foundIdx);
          continue;
        }
      }
      restored.push(null);
    }

    let unusedIdx = 0;
    return restored.map(slot => {
      if (slot) return slot;
      while (usedIndices.has(unusedIdx) && unusedIdx < defaultList.length) {
        unusedIdx++;
      }
      if (unusedIdx < defaultList.length) {
        usedIndices.add(unusedIdx);
        return defaultList[unusedIdx++];
      }
      return defaultList[0];
    });
  }

  // 2. If no saved answers, but the exercise was completed with high score (legacy saves):
  // Restore the correct matched pairs!
  if (isCompleted && (savedScore === undefined || savedScore === 100 || savedScore >= 80)) {
    return defaultList;
  }

  // 3. Otherwise scramble
  if (defaultList.length > 1) {
    return [...defaultList.slice(1), defaultList[0]];
  }
  return defaultList;
};

export const MatchingRunner: React.FC<MatchingRunnerProps> = ({
  pairs,
  checked,
  savedAnswers,
  isCompleted,
  savedScore,
  onAnswersChange,
  onCheckStateChange,
  hintTrigger
}) => {
  const { t } = useLanguage();
  // Initialize with saved answers if available, otherwise scramble
  const [answers, setAnswers] = useState<AnswerSlot[]>(() => {
    return buildInitialAnswers(pairs, savedAnswers, isCompleted, savedScore);
  });

  // Re-sync when pairs, savedAnswers, or completion status change
  useEffect(() => {
    setAnswers(buildInitialAnswers(pairs, savedAnswers, isCompleted, savedScore));
  }, [pairs, savedAnswers, isCompleted, savedScore]);

  // Notify parent of answers order
  useEffect(() => {
    onAnswersChange?.(answers.map(a => a.text));
  }, [answers, onAnswersChange]);

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
      if (clean(ans.text) === clean(pairs[idx].correctAnswer)) {
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
          <span>🔗</span> {t('matching_title')}
        </h3>
        <span className="text-xs text-slate-500 font-medium hidden sm:inline">
          {t('matching_hint_text')}
        </span>
      </div>

      <div className="space-y-3">
        {pairs.map((pair, idx) => {
          const currentAnswer = answers[idx];
          const isCorrect = checked && clean(currentAnswer?.text) === clean(pair.correctAnswer);
          const isWrong = checked && clean(currentAnswer?.text) !== clean(pair.correctAnswer);

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

