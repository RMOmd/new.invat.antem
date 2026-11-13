import React, { useState, useEffect, useRef } from 'react';
import { Activity, ActivityProgress, AIEvaluationResult } from '../types/course';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { AudioPlayer } from './AudioPlayer';
import { DialogueReorder } from './DialogueReorder';
import { QuizRunner } from './QuizRunner';
import { MatchingRunner } from './MatchingRunner';
import { AudioPlaylistRunner } from './AudioPlaylistRunner';
import { evaluateEssayWithGemini, isGeminiConfigured, saveGeminiApiKey } from '../lib/gemini';
import { CheckCircle2, RotateCcw, Lightbulb, Send, Award, ArrowLeft, ArrowRight, Eye, EyeOff, Sparkles, Copy, Check, AlertCircle } from 'lucide-react';
import confetti from 'canvas-confetti';

interface ExerciseRunnerProps {
  activity: Activity;
  savedProgress?: ActivityProgress;
  onSaveProgress: (progress: ActivityProgress) => void;
  onSubmitAssignment: (activityId: string, activityTitle: string, text: string, aiEvaluation?: AIEvaluationResult) => void;
  onPrev?: () => void;
  onNext?: () => void;
  hasPrev?: boolean;
  hasNext?: boolean;
}

export const ExerciseRunner: React.FC<ExerciseRunnerProps> = ({
  activity,
  savedProgress,
  onSaveProgress,
  onSubmitAssignment,
  onPrev,
  onNext,
  hasPrev,
  hasNext
}) => {
  const { t } = useLanguage();
  const { currentUser } = useAuth();
  const isTeacherOrAdmin = currentUser?.role === 'teacher' || currentUser?.role === 'admin';
  const gaps = activity.gaps || [];
  const orderItems = activity.orderItems || [];
  const quizQuestions = activity.quizQuestions || [];
  const matchingPairs = activity.matchingPairs || [];
  const audioTracks = activity.audioTracks || [];
  const isPlaylistType = activity.type === 'audio_playlist' || audioTracks.length > 0;
  const isAssignmentType = activity.type === 'assignment';
  const isMatchingType = activity.type === 'matching' || matchingPairs.length > 0;
  const hasInteractiveTask = gaps.length > 0 || orderItems.length > 0 || quizQuestions.length > 0 || isMatchingType || isAssignmentType;

  const bodyRef = useRef<HTMLDivElement>(null);

  const [answers, setAnswers] = useState<Record<number, string>>(() => {
    return savedProgress?.userAnswers || {};
  });

  const [quizAnswers, setQuizAnswers] = useState<Record<number, number>>({});

  const [checked, setChecked] = useState<boolean>(() => {
    return !!savedProgress?.completed;
  });

  const [activeGapIndex, setActiveGapIndex] = useState<number | null>(null);
  const [showAllSolutions, setShowAllSolutions] = useState(false);
  const [submissionText, setSubmissionText] = useState(() => {
    return savedProgress?.userAnswers?.[0] || '';
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedSuccess, setSubmittedSuccess] = useState(() => {
    return !!savedProgress?.completed && isAssignmentType;
  });

  // AI Evaluation state
  const [isAiEvaluating, setIsAiEvaluating] = useState(false);
  const [aiEvaluation, setAiEvaluation] = useState<AIEvaluationResult | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [copiedImproved, setCopiedImproved] = useState(false);
  const [showKeyPrompt, setShowKeyPrompt] = useState(false);
  const [keyInput, setKeyInput] = useState('');

  // Dialogue ordering state
  const [orderCorrectCount, setOrderCorrectCount] = useState(0);
  const [orderIsAllCorrect, setOrderIsAllCorrect] = useState(false);
  const [orderHintTrigger, setOrderHintTrigger] = useState(0);

  // Matching pairs state
  const [matchingCorrectCount, setMatchingCorrectCount] = useState(0);
  const [matchingIsAllCorrect, setMatchingIsAllCorrect] = useState(false);
  const [matchingHintTrigger, setMatchingHintTrigger] = useState(0);

  useEffect(() => {
    setAnswers(savedProgress?.userAnswers || {});
    setQuizAnswers({});
    setChecked(!!savedProgress?.completed);
    setShowAllSolutions(false);
    setActiveGapIndex(null);
    setSubmissionText(savedProgress?.userAnswers?.[0] || '');
    setSubmittedSuccess(!!savedProgress?.completed && isAssignmentType);
    setIsAiEvaluating(false);
    setAiEvaluation(null);
    setAiError(null);
    setCopiedImproved(false);
    setOrderHintTrigger(0);
    setMatchingHintTrigger(0);
    // Always scroll page and any scrollable container to top when switching exercises
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }, [activity.id, savedProgress, isAssignmentType]);

  const isGapCorrect = (gapIndex: number): boolean => {
    const gap = gaps.find(g => g.gapIndex === gapIndex);
    if (!gap) return false;
    const userAns = (answers[gapIndex] || '').trim().toLowerCase();
    return gap.correctAnswers.some(ans => ans.trim().toLowerCase() === userAns);
  };

  const isQuizCorrect = (qId: number): boolean => {
    const q = quizQuestions.find(item => item.id === qId);
    if (!q) return false;
    const selAnsIdx = quizAnswers[qId];
    if (selAnsIdx === undefined) return false;
    const opt = q.options.find(o => o.ansIdx === selAnsIdx);
    return !!opt?.isCorrect;
  };

  // Sync inputs and selects inside bodyHtml with React state
  useEffect(() => {
    if (!bodyRef.current) return;
    const formEls = bodyRef.current.querySelectorAll<HTMLInputElement | HTMLSelectElement>(
      'input.GapBox, input[id^="Gap"], select.GapBox, select[id^="Gap"]'
    );
    formEls.forEach((el, fallbackIdx) => {
      const match = el.id.match(/\d+/);
      const gapIdx = match ? parseInt(match[0], 10) : fallbackIdx;

      el.value = answers[gapIdx] || '';

      const handleInput = (e: any) => {
        const val = e.target.value;
        setAnswers(prev => ({ ...prev, [gapIdx]: val }));
        if (checked) setChecked(false);
      };

      el.oninput = handleInput;
      el.onchange = handleInput;

      el.onfocus = () => {
        setActiveGapIndex(gapIdx);
      };

      el.classList.remove('gap-correct', 'gap-wrong');
      if (checked) {
        if (isGapCorrect(gapIdx)) {
          el.classList.add('gap-correct');
        } else {
          el.classList.add('gap-wrong');
        }
      }
    });
  }, [activity.bodyHtml, answers, checked, gaps]);

  // Hint button: reveal next letter (for cloze) or advance order (for dialogue) or pick answer (for quiz/matching)
  const handleHint = () => {
    if (quizQuestions.length > 0) {
      const firstUnresolved = quizQuestions.find(q => !isQuizCorrect(q.id));
      if (firstUnresolved) {
        const correctOpt = firstUnresolved.options.find(o => o.isCorrect);
        if (correctOpt) {
          setQuizAnswers(prev => ({ ...prev, [firstUnresolved.id]: correctOpt.ansIdx }));
        }
      }
      if (checked) setChecked(false);
      return;
    }

    if (matchingPairs.length > 0) {
      setMatchingHintTrigger(prev => prev + 1);
      if (checked) setChecked(false);
      return;
    }

    if (orderItems.length > 0) {
      setOrderHintTrigger(prev => prev + 1);
      if (checked) setChecked(false);
      return;
    }

    if (gaps.length === 0) return;

    let targetIdx = activeGapIndex;
    if (targetIdx === null || isGapCorrect(targetIdx)) {
      const firstUnresolved = gaps.find(g => !isGapCorrect(g.gapIndex));
      targetIdx = firstUnresolved ? firstUnresolved.gapIndex : gaps[0].gapIndex;
    }

    const targetGap = gaps.find(g => g.gapIndex === targetIdx);
    if (!targetGap || !targetGap.correctAnswers.length) return;

    const fullTargetAnswer = targetGap.correctAnswers[0];
    const currentTyped = (answers[targetIdx] || '').trim();

    let matchLen = 0;
    while (
      matchLen < currentTyped.length &&
      matchLen < fullTargetAnswer.length &&
      currentTyped[matchLen].toLowerCase() === fullTargetAnswer[matchLen].toLowerCase()
    ) {
      matchLen++;
    }

    const nextLen = Math.min(matchLen + 1, fullTargetAnswer.length);
    const newAns = fullTargetAnswer.slice(0, nextLen);

    if (bodyRef.current) {
      const el = bodyRef.current.querySelector<HTMLInputElement | HTMLSelectElement>(
        `#Gap${targetIdx}, input[id$="${targetIdx}"], select[id$="${targetIdx}"]`
      );
      if (el) {
        if (el.tagName === 'SELECT') {
          el.value = fullTargetAnswer;
          setAnswers(prev => ({ ...prev, [targetIdx!]: fullTargetAnswer }));
        } else {
          el.value = newAns;
          setAnswers(prev => ({ ...prev, [targetIdx!]: newAns }));
        }
        el.focus();
      } else {
        setAnswers(prev => ({ ...prev, [targetIdx!]: newAns }));
      }
    } else {
      setAnswers(prev => ({ ...prev, [targetIdx!]: newAns }));
    }

    if (checked) setChecked(false);
  };

  const handleCheck = () => {
    if (isAssignmentType) {
      if (submissionText.trim()) {
        handleSubmitWork();
      } else {
        const textarea = document.getElementById('assignment-textarea');
        textarea?.focus();
      }
      return;
    }

    if (quizQuestions.length > 0) {
      const correctCount = quizQuestions.filter(q => isQuizCorrect(q.id)).length;
      const score = Math.round((correctCount / quizQuestions.length) * 100);
      const prog: ActivityProgress = {
        activityId: activity.id,
        completed: true,
        score,
        correctCount,
        totalGaps: quizQuestions.length,
        userAnswers: {},
        lastAttemptAt: new Date().toISOString()
      };
      onSaveProgress(prog);
      setChecked(true);
      if (score === 100) {
        confetti({ particleCount: 100, spread: 70, origin: { y: 0.7 } });
      }
      return;
    }

    if (matchingPairs.length > 0) {
      const score = Math.round((matchingCorrectCount / matchingPairs.length) * 100);
      const prog: ActivityProgress = {
        activityId: activity.id,
        completed: true,
        score,
        correctCount: matchingCorrectCount,
        totalGaps: matchingPairs.length,
        userAnswers: {},
        lastAttemptAt: new Date().toISOString()
      };
      onSaveProgress(prog);
      setChecked(true);
      if (score === 100) {
        confetti({ particleCount: 100, spread: 70, origin: { y: 0.7 } });
      }
      return;
    }

    if (orderItems.length > 0) {
      const score = Math.round((orderCorrectCount / orderItems.length) * 100);
      const prog: ActivityProgress = {
        activityId: activity.id,
        completed: true,
        score,
        correctCount: orderCorrectCount,
        totalGaps: orderItems.length,
        userAnswers: {},
        lastAttemptAt: new Date().toISOString()
      };
      onSaveProgress(prog);
      setChecked(true);
      if (score === 100) {
        confetti({ particleCount: 100, spread: 70, origin: { y: 0.7 } });
      }
      return;
    }

    if (gaps.length === 0) {
      const prog: ActivityProgress = {
        activityId: activity.id,
        completed: true,
        score: 100,
        correctCount: 0,
        totalGaps: 0,
        userAnswers: {},
        lastAttemptAt: new Date().toISOString()
      };
      onSaveProgress(prog);
      setChecked(true);
      confetti({ particleCount: 50, spread: 60, origin: { y: 0.8 } });
      return;
    }

    let correct = 0;
    gaps.forEach(g => {
      if (isGapCorrect(g.gapIndex)) {
        correct++;
      }
    });

    const score = Math.round((correct / gaps.length) * 100);
    const prog: ActivityProgress = {
      activityId: activity.id,
      completed: true,
      score,
      correctCount: correct,
      totalGaps: gaps.length,
      userAnswers: answers,
      lastAttemptAt: new Date().toISOString()
    };

    onSaveProgress(prog);
    setChecked(true);

    if (score === 100) {
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.7 }
      });
    }
  };

  const handleReset = () => {
    setAnswers({});
    setQuizAnswers({});
    setChecked(false);
    setShowAllSolutions(false);
    setOrderHintTrigger(0);
    setMatchingHintTrigger(0);
    if (bodyRef.current) {
      const formEls = bodyRef.current.querySelectorAll<HTMLInputElement | HTMLSelectElement>(
        'input.GapBox, input[id^="Gap"], select.GapBox, select[id^="Gap"]'
      );
      formEls.forEach(el => {
        el.value = '';
        el.classList.remove('gap-correct', 'gap-wrong');
      });
    }
  };

  const handleAiCheck = async () => {
    if (!submissionText.trim()) {
      const textarea = document.getElementById('assignment-textarea');
      textarea?.focus();
      return;
    }
    if (!isGeminiConfigured()) {
      setShowKeyPrompt(true);
      return;
    }
    setIsAiEvaluating(true);
    setAiError(null);
    try {
      const result = await evaluateEssayWithGemini(
        activity.title,
        submissionText,
        activity.instructions
      );
      setAiEvaluation(result);
    } catch (err: any) {
      console.error('AI check error:', err);
      if (!isGeminiConfigured() || err.message?.includes('nu este configurată')) {
        setShowKeyPrompt(true);
      }
      setAiError(err.message || 'Eroare la verificarea textului cu AI.');
    } finally {
      setIsAiEvaluating(false);
    }
  };

  const handleSubmitWork = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!submissionText.trim()) return;
    onSubmitAssignment(activity.id, activity.title, submissionText, aiEvaluation || undefined);
    setSubmittedSuccess(true);
    setChecked(true);
    setIsSubmitting(false);

    const score = aiEvaluation ? Math.round(aiEvaluation.grade * 10) : 100;
    const prog: ActivityProgress = {
      activityId: activity.id,
      completed: true,
      score,
      correctCount: 1,
      totalGaps: 1,
      userAnswers: { 0: submissionText },
      lastAttemptAt: new Date().toISOString()
    };
    onSaveProgress(prog);
    confetti({ particleCount: 100, spread: 70, origin: { y: 0.7 } });
  };

  // Use curated lesson audioFiles if provided, otherwise filter media for real lesson recordings
  const audioCandidates = activity.audioFiles !== undefined
    ? activity.audioFiles
    : (activity.media || []).filter(m => {
        const ext = m.split('.').pop()?.toLowerCase();
        if (ext !== 'mp3' && ext !== 'ogg' && ext !== 'wav') return false;
        const base = m.replace(/^\d+_/, '').split('?')[0].toLowerCase();
        // Skip hover word/number sound snippets
        if (/^\d+\.(mp3|ogg|wav)$/.test(base)) return false;
        if (['primavara.mp3', 'vara.mp3', 'toamna.mp3', 'iarna.mp3'].includes(base)) return false;
        return true;
      });

  const uniqueAudioMap = new Map<string, string>();
  audioCandidates.forEach(m => {
    const base = m.replace(/^\d+_/, '').split('?')[0];
    if (!uniqueAudioMap.has(base)) {
      uniqueAudioMap.set(base, m);
    }
  });
  const audioFiles = Array.from(uniqueAudioMap.values());

  const clozeCorrectCount = gaps.filter(g => isGapCorrect(g.gapIndex)).length;
  const quizCorrectCount = quizQuestions.filter(q => isQuizCorrect(q.id)).length;
  const currentTotal = quizQuestions.length > 0
    ? quizQuestions.length
    : matchingPairs.length > 0
    ? matchingPairs.length
    : orderItems.length > 0
    ? orderItems.length
    : gaps.length;
  const currentCorrect = quizQuestions.length > 0
    ? quizCorrectCount
    : matchingPairs.length > 0
    ? matchingCorrectCount
    : orderItems.length > 0
    ? orderCorrectCount
    : clozeCorrectCount;

  // Clean instructions to prevent repeating the entire dialogue in the header
  const showInstructions = activity.instructions &&
    activity.instructions.length < 120 &&
    !activity.instructions.includes('Bună ziua! Eu sunt') &&
    !activity.instructions.includes('Salut! Eu sunt');

  return (
    <div className="max-w-5xl lg:max-w-6xl mx-auto pb-28 pt-2 px-3 sm:px-6">
      {/* Activity Header */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-6 mb-4 shadow-xs">
        <div className="flex items-center justify-between gap-2 mb-2">
          <span className="text-xs font-semibold px-2.5 py-1 bg-blue-100 text-blue-800 rounded-md">
            #{activity.id}
          </span>
          {checked && (
            <span className={`text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1.5 ${
              (currentCorrect === currentTotal) ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
            }`}>
              <Award className="w-3.5 h-3.5" />
              {t('runner_score')}: {Math.round((currentCorrect / (currentTotal || 1)) * 100)}% ({t('runner_correct_count', { correct: currentCorrect, total: currentTotal })})
            </span>
          )}
        </div>

        <h1 className="text-xl sm:text-2xl font-bold text-slate-900 leading-snug">
          {activity.title}
        </h1>

        {/* Clean concise instructions */}
        {showInstructions && (
          <div className="mt-3 text-sm text-slate-700 bg-slate-50 border-l-4 border-blue-500 p-3 rounded-r-lg">
            <span className="font-semibold block text-slate-900 mb-0.5">Instrucțiuni:</span>
            {activity.instructions}
          </div>
        )}
      </div>

      {/* Lesson Audio Player(s) at the top ONLY if audio exists, is not a playlist, and is not already embedded inline in bodyHtml */}
      {!isPlaylistType && !activity.bodyHtml?.includes('<audio') && audioFiles.map((audioFn, idx) => {
        const audioSrc = audioFn.startsWith('media/') || audioFn.startsWith('http') ? audioFn : `media/${audioFn}`;
        const title = audioFiles.length > 1
          ? `Ascultă materialul audio (${idx + 1}/${audioFiles.length})`
          : 'Ascultă înregistrarea audio';
        return <AudioPlayer key={idx} src={audioSrc} title={title} />;
      })}

      {/* Reading / Dialogue Section if present in original lesson */}
      {activity.readingHtml && (
        <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-6 mb-4 shadow-xs">
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500 mb-3">
            Text / Dialog pentru lectură
          </h2>
          <div
            className="prose prose-slate max-w-none text-slate-800 leading-relaxed overflow-x-auto"
            dangerouslySetInnerHTML={{ __html: activity.readingHtml }}
          />
        </div>
      )}

      {/* Original Interactive Exercise Content */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-6 mb-6 shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500">
            Conținutul exercițiului
          </h2>
          {hasInteractiveTask && checked && currentCorrect < currentTotal && (
            <button
              type="button"
              onClick={() => setShowAllSolutions(!showAllSolutions)}
              className="text-xs font-semibold text-slate-500 hover:text-slate-800 flex items-center gap-1 cursor-pointer"
            >
              {showAllSolutions ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              {showAllSolutions ? t('runner_hide_answers') : t('runner_show_answers')}
            </button>
          )}
        </div>

        {/* Render HTML content (dialogues, cards, images) */}
        {activity.bodyHtml && (
          <div
            ref={bodyRef}
            className="prose prose-slate max-w-none text-slate-800 overflow-x-auto"
            dangerouslySetInnerHTML={{ __html: activity.bodyHtml }}
          />
        )}

        {/* Interactive Dialogue Reordering Component if orderItems exist */}
        {orderItems.length > 0 && (
          <DialogueReorder
            key={`order-${activity.id}`}
            orderItems={orderItems}
            checked={checked}
            onCheckStateChange={(isAllCorrect, correctCount) => {
              setOrderIsAllCorrect(isAllCorrect);
              setOrderCorrectCount(correctCount);
            }}
            hintTrigger={orderHintTrigger}
          />
        )}

        {/* Interactive Matching Pairs Component if matchingPairs exist */}
        {matchingPairs.length > 0 && (
          <MatchingRunner
            key={`match-${activity.id}`}
            pairs={matchingPairs}
            checked={checked}
            onCheckStateChange={(isAllCorrect, correctCount) => {
              setMatchingIsAllCorrect(isAllCorrect);
              setMatchingCorrectCount(correctCount);
            }}
            hintTrigger={matchingHintTrigger}
          />
        )}

        {/* Interactive Multiple Choice / True-False Quiz if quizQuestions exist */}
        {quizQuestions.length > 0 && (
          <QuizRunner
            key={`quiz-${activity.id}`}
            questions={quizQuestions}
            selectedAnswers={quizAnswers}
            onSelectAnswer={(qId, ansIdx) => {
              setQuizAnswers(prev => ({ ...prev, [qId]: ansIdx }));
              if (checked) setChecked(false);
            }}
            checked={checked}
          />
        )}

        {/* Interactive Audio Playlist Component if audioTracks exist */}
        {isPlaylistType && (
          <AudioPlaylistRunner
            key={`playlist-${activity.id}`}
            tracks={audioTracks}
            title={activity.title}
          />
        )}

        {/* Optional solution reveal if requested */}
        {showAllSolutions && (
          <div className="mt-6 pt-5 border-t border-slate-200 space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
              {t('runner_correct_answers_title')}
            </h3>
            <div className="space-y-1.5">
              {quizQuestions.length > 0 ? (
                quizQuestions.map((q, idx) => {
                  const correctOpt = q.options.find(o => o.isCorrect);
                  return (
                    <div key={q.id} className="p-2.5 rounded-xl border border-slate-200 bg-slate-50 text-xs flex items-center justify-between gap-2">
                      <span className="font-semibold text-slate-700">#{idx + 1}. {q.question}</span>
                      <span className="font-bold text-emerald-800">{correctOpt?.text || ''}</span>
                    </div>
                  );
                })
              ) : matchingPairs.length > 0 ? (
                matchingPairs.map((pair, idx) => (
                  <div key={idx} className="p-2.5 rounded-xl border border-slate-200 bg-slate-50 text-xs flex items-center justify-between gap-2">
                    <span className="font-semibold text-slate-800">{pair.prompt}</span>
                    <span className="font-bold text-emerald-800">→ {pair.correctAnswer}</span>
                  </div>
                ))
              ) : orderItems.length > 0 ? (
                orderItems.map((item, idx) => (
                  <div key={idx} className="p-2.5 rounded-xl border border-slate-200 bg-slate-50 text-xs flex items-center gap-2">
                    <span className="font-bold text-slate-600">{idx + 1}.</span>
                    <span className="font-medium text-slate-900">{item}</span>
                  </div>
                ))
              ) : (
                gaps.map((gap, idx) => (
                  <div key={gap.gapIndex} className="p-2.5 rounded-xl border border-slate-200 bg-slate-50 text-xs flex items-center justify-between gap-2">
                    <span className="font-semibold text-slate-700">{t('runner_gap_label', { num: idx + 1 })}</span>
                    <span className="font-mono font-bold text-emerald-800">{gap.correctAnswers.join(' / ')}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {/* Assignment submission block only for assignments (essay / writing tasks) */}
      {isAssignmentType && (
        <div className="rounded-2xl p-4 sm:p-6 mb-6 shadow-xs border transition-all bg-amber-50 bg-gradient-to-br from-amber-50/90 to-orange-50/90 border-amber-300 ring-1 ring-amber-200">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm sm:text-base font-bold text-amber-950 flex items-center gap-2">
              <Send className="w-5 h-5 text-amber-600 shrink-0" />
              {t('assign_teacher_title')}
            </h3>
          </div>

          {submittedSuccess && (
            <div className="p-3.5 bg-emerald-100 text-emerald-900 border border-emerald-300 rounded-xl text-sm font-semibold flex items-center gap-2.5 my-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              {t('assign_success_msg')}
            </div>
          )}

          <form onSubmit={handleSubmitWork} className="mt-3">
            <textarea
              id="assignment-textarea"
              rows={6}
              value={submissionText}
              onChange={e => setSubmissionText(e.target.value)}
              placeholder={t('assign_ph_structured')}
              className="w-full text-base p-3.5 bg-white border border-amber-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 mb-3 shadow-inner"
              required
            />
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <span className="text-xs text-amber-800 font-medium">
                {t('assign_chars_count', { count: submissionText.length })}
              </span>
              <div className="flex flex-wrap items-center gap-2">
                {isTeacherOrAdmin && (
                  <button
                    type="button"
                    onClick={handleAiCheck}
                    disabled={isAiEvaluating || !submissionText.trim()}
                    className="px-4 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 disabled:opacity-50 text-white font-bold rounded-xl shadow-xs text-sm active:scale-95 transition-all flex items-center gap-2 cursor-pointer"
                    title="Verifică textul cu profesorul AI (Profesor / Administrator)"
                  >
                    <Sparkles className={`w-4 h-4 ${isAiEvaluating ? 'animate-spin' : ''}`} />
                    {isAiEvaluating ? t('ai_checking') : t('ai_btn_check')}
                  </button>
                )}
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl shadow-xs text-sm active:scale-95 transition-all flex items-center gap-2 cursor-pointer"
                >
                  <Send className="w-4 h-4" />
                  {t('assign_btn_submit')}
                </button>
              </div>
            </div>
          </form>

          {isTeacherOrAdmin && showKeyPrompt && (
            <div className="mt-4 p-4 bg-purple-50/90 border-2 border-purple-300 rounded-2xl shadow-sm space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs sm:text-sm font-bold text-purple-950 flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-purple-600" />
                  Configurare cheie API Gemini (Gratuit)
                </span>
                <button
                  type="button"
                  onClick={() => setShowKeyPrompt(false)}
                  className="text-xs text-purple-400 hover:text-purple-700 font-bold p-1 cursor-pointer"
                >
                  ✕
                </button>
              </div>
              <p className="text-xs text-purple-900 leading-relaxed">
                Pentru activarea asistentului AI, introduceți cheia API gratuită de pe{' '}
                <a
                  href="https://aistudio.google.com/"
                  target="_blank"
                  rel="noreferrer"
                  className="font-bold underline text-purple-700 hover:text-purple-950"
                >
                  Google AI Studio
                </a>{' '}
                (se obține gratuit în 30 de secunde, fără card bancar):
              </p>
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="password"
                  value={keyInput}
                  onChange={e => setKeyInput(e.target.value)}
                  placeholder="Introduceți cheia API (ex: AQ.Ab8...)"
                  className="flex-1 px-3.5 py-2 text-xs sm:text-sm bg-white border border-purple-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 font-mono shadow-inner"
                />
                <button
                  type="button"
                  onClick={() => {
                    if (keyInput.trim()) {
                      saveGeminiApiKey(keyInput.trim());
                      setShowKeyPrompt(false);
                      setAiError(null);
                      // Trigger evaluation immediately with saved key
                      setTimeout(() => {
                        handleAiCheck();
                      }, 100);
                    }
                  }}
                  disabled={!keyInput.trim()}
                  className="px-5 py-2 bg-purple-700 hover:bg-purple-800 disabled:opacity-50 text-white font-bold text-xs sm:text-sm rounded-xl shadow-xs transition-colors cursor-pointer"
                >
                  Salvează cheia
                </button>
              </div>
            </div>
          )}

          {aiError && (
            <div className="mt-3 p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
              <span>{aiError}</span>
            </div>
          )}

          {isTeacherOrAdmin && aiEvaluation && (
            <div className="mt-4 p-4 sm:p-5 bg-white border-2 border-purple-200 rounded-2xl shadow-sm space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-2 pb-3 border-b border-purple-100">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center font-bold">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-900">
                      Evaluare Pedagogică AI (Nivel A1-A2)
                    </h4>
                    <p className="text-xs text-slate-500">
                      Standardul ANTEM • Feedback personalizat
                    </p>
                  </div>
                </div>

                <div className={`px-3 py-1.5 rounded-xl border font-bold text-sm flex items-center gap-1.5 ${
                  aiEvaluation.grade >= 8.5
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                    : aiEvaluation.grade >= 6.5
                    ? 'bg-amber-50 text-amber-800 border-amber-300'
                    : 'bg-rose-50 text-rose-800 border-rose-300'
                }`}>
                  <Award className="w-4 h-4" />
                  <span>{t('ai_score_badge')}: {aiEvaluation.grade}/10</span>
                </div>
              </div>

              <div className="bg-purple-50/70 p-3.5 rounded-xl border border-purple-200 text-sm text-purple-950 leading-relaxed">
                {aiEvaluation.summary}
              </div>

              {aiEvaluation.strengths && aiEvaluation.strengths.length > 0 && (
                <div>
                  <h5 className="text-xs font-bold text-emerald-800 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    {t('ai_strengths')}
                  </h5>
                  <ul className="space-y-1.5">
                    {aiEvaluation.strengths.map((str, idx) => (
                      <li key={idx} className="text-xs text-slate-700 flex items-start gap-2 bg-emerald-50/50 p-2 rounded-lg border border-emerald-100">
                        <span className="text-emerald-600 font-bold">✓</span>
                        <span>{str}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {aiEvaluation.corrections && aiEvaluation.corrections.length > 0 && (
                <div>
                  <h5 className="text-xs font-bold text-amber-900 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <Lightbulb className="w-3.5 h-3.5 text-amber-600" />
                    {t('ai_corrections')} ({aiEvaluation.corrections.length})
                  </h5>
                  <div className="space-y-2">
                    {aiEvaluation.corrections.map((corr, idx) => (
                      <div key={idx} className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="line-through text-rose-600 font-medium bg-rose-50 px-2 py-0.5 rounded">
                            {corr.original}
                          </span>
                          <span className="text-slate-400">➔</span>
                          <span className="font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                            {corr.corrected}
                          </span>
                        </div>
                        <p className="text-slate-600 pt-0.5">{corr.explanation}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {aiEvaluation.improvedText && (
                <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <h5 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                      {t('ai_improved')}
                    </h5>
                    <button
                      type="button"
                      onClick={() => {
                        setSubmissionText(aiEvaluation.improvedText);
                        navigator.clipboard?.writeText(aiEvaluation.improvedText);
                        setCopiedImproved(true);
                        setTimeout(() => setCopiedImproved(false), 2000);
                      }}
                      className="text-xs text-purple-700 hover:text-purple-900 font-semibold flex items-center gap-1 cursor-pointer"
                    >
                      {copiedImproved ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                      {copiedImproved ? t('ai_copied') : t('ai_use_improved')}
                    </button>
                  </div>
                  <p className="text-xs sm:text-sm text-slate-800 italic bg-white p-2.5 rounded-lg border border-slate-200">
                    "{aiEvaluation.improvedText}"
                  </p>
                </div>
              )}

              {aiEvaluation.recommendation && (
                <div className="text-xs text-indigo-900 bg-indigo-50/70 p-3 rounded-xl border border-indigo-100 flex items-start gap-2">
                  <Lightbulb className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold block">{t('ai_recommendation')}:</span>
                    <span>{aiEvaluation.recommendation}</span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Sticky Bottom Bar for Mobile & Desktop - Thumb Friendly */}
      <div className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-slate-200 p-3 sm:py-4 z-40 shadow-lg">
        <div className="max-w-5xl lg:max-w-6xl mx-auto flex items-center justify-between gap-2 sm:gap-4">
          <div className="flex items-center gap-1.5 sm:gap-2">
            {hasPrev && (
              <button
                onClick={onPrev}
                type="button"
                className="p-2.5 text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl active:scale-95 transition-all cursor-pointer"
                title={t('runner_prev')}
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
            )}

            {hasInteractiveTask && (
              <>
                <button
                  onClick={handleReset}
                  type="button"
                  className="p-2.5 text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl active:scale-95 transition-all cursor-pointer"
                  title={t('runner_reset')}
                >
                  <RotateCcw className="w-5 h-5" />
                </button>

                {/* Hint Button */}
                <button
                  onClick={handleHint}
                  type="button"
                  className="px-2.5 sm:px-3 py-2 bg-amber-100 hover:bg-amber-200 active:scale-95 text-amber-900 rounded-xl transition-all flex items-center gap-1 font-bold text-xs shrink-0 cursor-pointer"
                  title={t('runner_hint')}
                >
                  <Lightbulb className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>{t('runner_hint')}</span>
                  <span className="hidden sm:inline">
                    {quizQuestions.length > 0
                      ? t('runner_hint_answer')
                      : (matchingPairs.length > 0 || orderItems.length > 0)
                      ? t('runner_hint_step')
                      : t('runner_hint_letter')}
                  </span>
                </button>
              </>
            )}
          </div>

          <button
            onClick={handleCheck}
            type="button"
            className="flex-1 max-w-xs py-3 px-5 bg-blue-600 hover:bg-blue-700 active:scale-98 text-white font-bold rounded-xl shadow-md text-sm sm:text-base transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <CheckCircle2 className="w-5 h-5" />
            {isPlaylistType
              ? (checked ? t('runner_listened_done') : t('runner_mark_listened'))
              : isAssignmentType
              ? (submittedSuccess ? t('runner_submitted_done') : t('runner_submit_assignment'))
              : hasInteractiveTask
              ? (checked ? t('runner_recheck') : t('runner_check'))
              : t('runner_mark_read')}
          </button>

          {hasNext && (
            <button
              onClick={onNext}
              type="button"
              className="p-2.5 text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl active:scale-95 transition-all cursor-pointer"
              title={t('runner_next')}
            >
              <ArrowRight className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
