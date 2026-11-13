import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { evaluateEssayWithGemini, isGeminiConfigured, saveGeminiApiKey } from '../lib/gemini';
import { CheckCircle2, Clock, MessageSquare, Send, Award, User, Sparkles, Lightbulb, AlertCircle } from 'lucide-react';

export const SubmissionsView: React.FC = () => {
  const { currentUser, allSubmissions, reviewSubmission } = useAuth();
  const { t } = useLanguage();
  const [selectedSubId, setSelectedSubId] = useState<string | null>(null);
  const [gradeInput, setGradeInput] = useState<number>(10);
  const [feedbackInput, setFeedbackInput] = useState('');
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  const isTeacher = currentUser?.role === 'teacher' || currentUser?.role === 'admin';

  // If student, filter by their own submissions; if teacher, show all
  const visibleSubmissions = isTeacher
    ? allSubmissions
    : allSubmissions.filter(s => s.userId === currentUser?.id);

  const handleReview = (subId: string) => {
    reviewSubmission(subId, Number(gradeInput), feedbackInput);
    setSelectedSubId(null);
    setFeedbackInput('');
  };

  return (
    <div className="max-w-4xl mx-auto px-3 sm:px-4 py-4 pb-28">
      <div className="bg-white border border-slate-200 rounded-2xl p-5 mb-6 shadow-xs">
        <div className="flex items-center justify-between gap-2 mb-1">
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900">
            {isTeacher ? t('subs_teacher_title') : t('subs_student_title')}
          </h1>
          <span className={`text-xs font-bold px-3 py-1 rounded-full ${
            currentUser?.role === 'admin'
              ? 'bg-rose-100 text-rose-800'
              : isTeacher
              ? 'bg-purple-100 text-purple-800'
              : 'bg-blue-100 text-blue-800'
          }`}>
            {currentUser?.role === 'admin' ? t('role_admin') : isTeacher ? t('role_teacher') : t('role_student')}
          </span>
        </div>
        <p className="text-sm text-slate-500">
          {isTeacher ? t('subs_teacher_desc') : t('subs_student_desc')}
        </p>
      </div>

      {visibleSubmissions.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center text-slate-500 shadow-2xs">
          <MessageSquare className="w-10 h-10 text-slate-300 mx-auto mb-2" />
          <p className="font-semibold text-slate-700">{t('subs_empty_title')}</p>
          <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
            {t('subs_empty_desc')}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {visibleSubmissions.map(sub => {
            const isReviewed = sub.status === 'reviewed';

            return (
              <div
                key={sub.id}
                className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs transition-all"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-mono text-slate-400">
                        #{sub.activityId}
                      </span>
                      <span className="text-xs text-slate-500">
                        {new Date(sub.createdAt).toLocaleString()}
                      </span>
                      {isTeacher && (
                        <span className="text-xs font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md flex items-center gap-1">
                          <User className="w-3 h-3 text-slate-400" /> {sub.userName} ({sub.userEmail})
                        </span>
                      )}
                    </div>
                    <h3 className="text-base font-bold text-slate-900">
                      {sub.activityTitle}
                    </h3>
                  </div>

                  <span className={`inline-flex items-center gap-1 text-xs font-bold px-3 py-1 rounded-full shrink-0 w-fit ${
                    isReviewed
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-amber-100 text-amber-800'
                  }`}>
                    {isReviewed ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Clock className="w-3.5 h-3.5" />}
                    {isReviewed ? `Verificat • Nota ${sub.grade}/10` : 'În așteptare'}
                  </span>
                </div>

                {/* Student's answer */}
                <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-sm text-slate-800 mb-3 whitespace-pre-wrap">
                  <span className="text-xs font-bold text-slate-500 block mb-1">Răspunsul studentului:</span>
                  {sub.submissionText}
                </div>

                {/* AI Evaluation details if available */}
                {sub.aiEvaluation && (
                  <div className="bg-purple-50/50 p-3.5 rounded-xl border border-purple-200 text-xs space-y-2 mb-3">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-purple-900 flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-purple-600" />
                        Analiză AI Pedagogică (Nota estimată: {sub.aiEvaluation.grade}/10)
                      </span>
                    </div>
                    {sub.aiEvaluation.corrections && sub.aiEvaluation.corrections.length > 0 && (
                      <div className="space-y-1 pt-1">
                        <span className="font-semibold text-slate-700 block">Corecturi identificate:</span>
                        {sub.aiEvaluation.corrections.map((c, i) => (
                          <div key={i} className="flex flex-wrap items-center gap-1.5 bg-white p-1.5 rounded border border-purple-100">
                            <span className="line-through text-rose-600">{c.original}</span>
                            <span className="text-slate-400">➔</span>
                            <span className="font-bold text-emerald-700">{c.corrected}</span>
                            <span className="text-slate-500 text-[11px]">({c.explanation})</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {sub.aiEvaluation.improvedText && (
                      <div className="pt-1">
                        <span className="font-semibold text-slate-700 block mb-0.5">Varianta îmbunătățită:</span>
                        <p className="italic bg-white p-2 rounded border border-purple-100 text-slate-800">
                          "{sub.aiEvaluation.improvedText}"
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* Teacher feedback if reviewed */}
                {isReviewed && sub.teacherFeedback && (
                  <div className="bg-emerald-50/70 p-3.5 rounded-xl border border-emerald-200 text-sm text-emerald-900 mb-2">
                    <span className="text-xs font-bold text-emerald-700 flex items-center gap-1 mb-1">
                      <Award className="w-3.5 h-3.5" /> {t('subs_feedback_label')}
                    </span>
                    <div className="whitespace-pre-wrap">{sub.teacherFeedback}</div>
                  </div>
                )}

                {/* Teacher evaluation form */}
                {isTeacher && !isReviewed && (
                  <div className="mt-3 pt-3 border-t border-slate-100">
                    {selectedSubId === sub.id ? (
                      <div className="bg-purple-50/60 p-4 rounded-xl border border-purple-200 space-y-3">
                        <div className="flex items-center justify-between flex-wrap gap-2">
                          <div className="flex items-center gap-3">
                            <label className="text-xs font-bold text-purple-900">{t('subs_grade_label')} (1 - 10):</label>
                            <input
                              type="number"
                              min={1}
                              max={10}
                              step={0.5}
                              value={gradeInput}
                              onChange={e => setGradeInput(Number(e.target.value))}
                              className="w-20 px-3 py-1.5 text-sm bg-white border border-purple-300 rounded-lg text-center font-bold"
                            />
                          </div>
                          <button
                            type="button"
                            disabled={isAiLoading}
                            onClick={async () => {
                              setIsAiLoading(true);
                              setAiError(null);
                              try {
                                const res = await evaluateEssayWithGemini(sub.activityTitle, sub.submissionText);
                                setGradeInput(res.grade);
                                let feedback = `${res.summary}\n\n`;
                                if (res.corrections && res.corrections.length > 0) {
                                  feedback += `Corecturi:\n` + res.corrections.map(c => `• ${c.original} ➔ ${c.corrected} (${c.explanation})`).join('\n') + `\n\n`;
                                }
                                if (res.improvedText) {
                                  feedback += `Varianta recomandată:\n"${res.improvedText}"\n\n`;
                                }
                                if (res.recommendation) {
                                  feedback += `Sfat: ${res.recommendation}`;
                                }
                                setFeedbackInput(feedback.trim());
                              } catch (err: any) {
                                setAiError(err.message || 'Eroare AI');
                              } finally {
                                setIsAiLoading(false);
                              }
                            }}
                            className="px-3 py-1.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white text-xs font-bold rounded-lg shadow-xs flex items-center gap-1.5 transition-all cursor-pointer"
                          >
                            <Sparkles className={`w-3.5 h-3.5 ${isAiLoading ? 'animate-spin' : ''}`} />
                            {isAiLoading ? t('ai_checking') : t('ai_teacher_copilot')}
                          </button>
                        </div>

                        {aiError && (
                          <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800 flex items-center gap-2">
                            <AlertCircle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                            <span>{aiError}</span>
                          </div>
                        )}

                        <div>
                          <label className="text-xs font-bold text-purple-900 block mb-1">{t('subs_feedback_label')}</label>
                          <textarea
                            rows={4}
                            value={feedbackInput}
                            onChange={e => setFeedbackInput(e.target.value)}
                            placeholder={t('subs_feedback_ph')}
                            className="w-full text-sm p-2.5 bg-white border border-purple-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-400"
                          />
                        </div>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => handleReview(sub.id)}
                            className="px-4 py-2 bg-purple-700 hover:bg-purple-800 text-white text-xs font-bold rounded-lg transition-colors cursor-pointer"
                          >
                            {t('subs_btn_save_grade')}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedSubId(null);
                              setAiError(null);
                            }}
                            className="px-4 py-2 bg-slate-200 text-slate-700 text-xs font-bold rounded-lg hover:bg-slate-300 transition-colors cursor-pointer"
                          >
                            {t('assign_btn_cancel')}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedSubId(sub.id);
                          setGradeInput(sub.grade || 10);
                          setFeedbackInput(sub.teacherFeedback || '');
                          setAiError(null);
                        }}
                        className="px-4 py-2 bg-purple-100 hover:bg-purple-200 text-purple-800 text-xs font-bold rounded-xl transition-colors cursor-pointer"
                      >
                        {t('subs_btn_review')}
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

