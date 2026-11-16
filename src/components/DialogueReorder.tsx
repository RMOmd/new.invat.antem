import React, { useState, useEffect } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { ArrowUp, ArrowDown, CheckCircle2, XCircle } from 'lucide-react';

interface DialogueReorderProps {
  orderItems: string[];
  checked: boolean;
  savedOrder?: Record<string | number, string> | string[];
  isCompleted?: boolean;
  savedScore?: number;
  onOrderChange?: (order: string[]) => void;
  onCheckStateChange: (isAllCorrect: boolean, correctCount: number) => void;
  hintTrigger: number;
}

interface OrderItem {
  origIdx: number;
  text: string;
}

const clean = (s: string) => (s || '').trim().replace(/\s+/g, ' ');

const buildInitialItems = (
  listItems: string[],
  saved?: Record<string | number, string> | string[],
  isCompleted?: boolean,
  savedScore?: number
): OrderItem[] => {
  const defaultList: OrderItem[] = listItems.map((text, origIdx) => ({ origIdx, text }));

  const hasSavedAnswers = saved && (
    Array.isArray(saved) 
      ? saved.length > 0 
      : Object.keys(saved).length > 0 && Object.values(saved).some(v => typeof v === 'string' && v.trim().length > 0)
  );

  // 1. If explicit answers are saved, restore them
  if (hasSavedAnswers) {
    const usedIndices = new Set<number>();
    const restored: (OrderItem | null)[] = [];

    for (let i = 0; i < listItems.length; i++) {
      const savedText = Array.isArray(saved) ? saved[i] : (saved[i] || saved[String(i)]);
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
    const finalItems = restored.map(slot => {
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

    // If marked completed with high score (100%), but the restored answers have 0 correct slots
    // (i.e. corrupted or saved from initial scrambled state), fall back to the solved order (defaultList)!
    const isCompletedGood = !!isCompleted && (savedScore === undefined || savedScore === 100 || savedScore >= 80);
    if (isCompletedGood) {
      let matchingCount = 0;
      finalItems.forEach((it, idx) => {
        if (clean(it.text) === clean(listItems[idx])) matchingCount++;
      });
      if (matchingCount === 0 || matchingCount < listItems.length * 0.7) {
        return defaultList;
      }
    }

    return finalItems;
  }

  // 2. If no saved order stored, but the exercise was completed with high score (legacy saves where userAnswers was {}):
  // Restore the correct solved order so it's not shown as red errors!
  if (isCompleted && (savedScore === undefined || savedScore === 100 || savedScore >= 80)) {
    return defaultList;
  }

  // 3. Otherwise (uncompleted), start with scrambled order
  if (defaultList.length > 1) {
    return [...defaultList.slice(1), defaultList[0]];
  }
  return defaultList;
};

export const DialogueReorder: React.FC<DialogueReorderProps> = ({
  orderItems,
  checked,
  savedOrder,
  isCompleted,
  savedScore,
  onOrderChange,
  onCheckStateChange,
  hintTrigger
}) => {
  const { t } = useLanguage();
  // Initialize with saved order if available, otherwise deterministic shift
  const [items, setItems] = useState<OrderItem[]>(() => {
    return buildInitialItems(orderItems, savedOrder, isCompleted, savedScore);
  });

  // Re-sync whenever orderItems, savedOrder, or completion status change
  useEffect(() => {
    setItems(buildInitialItems(orderItems, savedOrder, isCompleted, savedScore));
  }, [orderItems, savedOrder, isCompleted, savedScore]);

  // Notify parent of items order
  useEffect(() => {
    onOrderChange?.(items.map(it => it.text));
  }, [items, onOrderChange]);

  // Handle Hint: puts the first misplaced item into its correct slot
  useEffect(() => {
    if (hintTrigger === 0) return;
    setItems(prev => {
      const next = [...prev];
      for (let slot = 0; slot < orderItems.length; slot++) {
        if (clean(next[slot].text) !== clean(orderItems[slot])) {
          // Find the matching item in remaining slots
          const targetIdx = next.findIndex((item, i) => i > slot && clean(item.text) === clean(orderItems[slot]));
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
  }, [hintTrigger, orderItems]);

  const moveUp = (idx: number) => {
    if (idx <= 0) return;
    setItems(prev => {
      const next = [...prev];
      const temp = next[idx];
      next[idx] = next[idx - 1];
      next[idx - 1] = temp;
      return next;
    });
  };

  const moveDown = (idx: number) => {
    if (idx >= items.length - 1) return;
    setItems(prev => {
      const next = [...prev];
      const temp = next[idx];
      next[idx] = next[idx + 1];
      next[idx + 1] = temp;
      return next;
    });
  };

  // Evaluate correctness and notify parent
  useEffect(() => {
    let correct = 0;
    items.forEach((item, idx) => {
      if (clean(item.text) === clean(orderItems[idx])) {
        correct++;
      }
    });
    onCheckStateChange(correct === orderItems.length, correct);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, orderItems]);

  return (
    <div className="mt-6 pt-5 border-t border-slate-200">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
          <span>🧩</span> {t('dialogue_title')}
        </h3>
        <span className="text-xs text-slate-500 font-medium hidden sm:inline">
          {t('dialogue_hint_text')}
        </span>
      </div>

      <div className="space-y-2.5">
        {items.map((item, idx) => {
          const isCorrectPosition = checked && clean(item.text) === clean(orderItems[idx]);
          const isWrongPosition = checked && clean(item.text) !== clean(orderItems[idx]);

          return (
            <div
              key={`dialogue-item-${item.origIdx}`}
              className={`p-3 sm:p-4 rounded-xl border flex items-center justify-between gap-3 transition-all ${
                isCorrectPosition
                  ? 'bg-emerald-50/80 border-emerald-400 text-emerald-950 shadow-2xs'
                  : isWrongPosition
                  ? 'bg-rose-50/80 border-rose-300 text-rose-950'
                  : 'bg-white border-slate-200 hover:border-slate-300 shadow-2xs'
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <span className={`w-7 h-7 rounded-lg text-xs font-bold flex items-center justify-center shrink-0 ${
                  isCorrectPosition
                    ? 'bg-emerald-200 text-emerald-900'
                    : isWrongPosition
                    ? 'bg-rose-200 text-rose-900'
                    : 'bg-slate-100 text-slate-700'
                }`}>
                  {idx + 1}.
                </span>
                <span className="text-sm sm:text-base font-medium select-none break-words">
                  {item.text}
                </span>
              </div>

              <div className="flex items-center gap-1 shrink-0">
                {checked && (
                  <span className="mr-2">
                    {isCorrectPosition ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                    ) : (
                      <XCircle className="w-5 h-5 text-rose-500" />
                    )}
                  </span>
                )}

                <button
                  type="button"
                  onClick={() => moveUp(idx)}
                  disabled={idx === 0}
                  className={`p-2 rounded-lg border transition-all ${
                    idx === 0
                      ? 'border-slate-100 text-slate-300 cursor-not-allowed'
                      : 'border-slate-200 hover:bg-slate-100 text-slate-700 active:scale-95'
                  }`}
                  title="Mută mai sus"
                >
                  <ArrowUp className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => moveDown(idx)}
                  disabled={idx === items.length - 1}
                  className={`p-2 rounded-lg border transition-all ${
                    idx === items.length - 1
                      ? 'border-slate-100 text-slate-300 cursor-not-allowed'
                      : 'border-slate-200 hover:bg-slate-100 text-slate-700 active:scale-95'
                  }`}
                  title="Mută mai jos"
                >
                  <ArrowDown className="w-4 h-4" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
