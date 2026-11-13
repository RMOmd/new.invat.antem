import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { AssignmentSubmission } from '../types/course';
import { evaluateEssayWithGemini, isGeminiConfigured, saveGeminiApiKey } from '../lib/gemini';
import { getTelegramConfig, saveTelegramConfig, isTelegramConfigured, sendTelegramMessage } from '../lib/telegram';
import { CheckCircle2, Clock, MessageSquare, Send, Award, User, Sparkles, Lightbulb, AlertCircle, Eye, Trash2, RefreshCw, Bell, Settings, Check, X, ChevronDown, ChevronUp, ChevronsUpDown, Filter } from 'lucide-react';

interface ParsedFeedback {
  summary: string;
  corrections: { original: string; corrected: string; explanation: string }[];
  improvedText: string;
  tip: string;
}

function parseFeedback(text: string): ParsedFeedback {
  let summary = '';
  const corrections: { original: string; corrected: string; explanation: string }[] = [];
  let improvedText = '';
  let tip = '';

  const corrIdx = text.indexOf('Corecturi:');
  const varIdx = text.indexOf('Varianta recomandată:');
  const sfatIdx = text.indexOf('Sfat:');

  if (corrIdx !== -1) {
    summary = text.substring(0, corrIdx).trim();
    const corrEnd = varIdx !== -1 ? varIdx : (sfatIdx !== -1 ? sfatIdx : text.length);
    const corrBlock = text.substring(corrIdx + 'Corecturi:'.length, corrEnd).trim();

    const lines = corrBlock.split('\n');
    for (const l of lines) {
      const line = l.trim().replace(/^[•\-*]\s*/, '');
      if (!line) continue;
      const parts = line.split('➔');
      if (parts.length >= 2) {
        const original = parts[0].trim();
        const rest = parts.slice(1).join('➔').trim();
        let corrected = rest;
        let explanation = '';
        const firstParen = rest.indexOf(' (');
        if (firstParen !== -1 && rest.endsWith(')')) {
          explanation = rest.substring(firstParen + 2, rest.length - 1).trim();
          corrected = rest.substring(0, firstParen).trim();
        }
        corrections.push({ original, corrected, explanation });
      } else {
        corrections.push({ original: '', corrected: line, explanation: '' });
      }
    }
  } else if (varIdx !== -1) {
    summary = text.substring(0, varIdx).trim();
  } else if (sfatIdx !== -1) {
    summary = text.substring(0, sfatIdx).trim();
  } else {
    summary = text.trim();
  }

  if (varIdx !== -1) {
    const varEnd = sfatIdx !== -1 ? sfatIdx : text.length;
    improvedText = text.substring(varIdx + 'Varianta recomandată:'.length, varEnd).trim().replace(/^["']|["']$/g, '');
  }

  if (sfatIdx !== -1) {
    tip = text.substring(sfatIdx + 'Sfat:'.length).trim();
  }

  return { summary, corrections, improvedText, tip };
}

export const FormattedFeedback: React.FC<{ feedback: string }> = ({ feedback }) => {
  const parsed = parseFeedback(feedback);
  const isStructured = parsed.corrections.length > 0 || !!parsed.improvedText || !!parsed.tip;

  if (!isStructured) {
    return <div className="whitespace-pre-wrap leading-relaxed">{feedback}</div>;
  }

  return (
    <div className="space-y-3 pt-1">
      {/* 1. Summary / Encouragement */}
      {parsed.summary && (
        <div className="bg-white/90 p-3.5 rounded-xl border border-emerald-200 text-sm text-emerald-950 leading-relaxed font-medium shadow-2xs">
          {parsed.summary}
        </div>
      )}

      {/* 2. Corrections */}
      {parsed.corrections.length > 0 && (
        <div className="space-y-2">
          <div className="text-xs font-bold text-amber-900 uppercase tracking-wider flex items-center gap-1.5">
            <Lightbulb className="w-3.5 h-3.5 text-amber-600" />
            Corecturi și explicații ({parsed.corrections.length})
          </div>
          <div className="grid grid-cols-1 gap-2">
            {parsed.corrections.map((c, i) => (
              <div key={i} className="p-3 rounded-xl bg-white border border-amber-200 text-xs space-y-1.5 shadow-2xs">
                <div className="flex flex-wrap items-center gap-2">
                  {c.original && (
                    <>
                      <span className="line-through text-rose-600 font-medium bg-rose-50 px-2 py-0.5 rounded border border-rose-100">
                        {c.original}
                      </span>
                      <span className="text-slate-400 font-bold">➔</span>
                    </>
                  )}
                  <span className="font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                    {c.corrected}
                  </span>
                </div>
                {c.explanation && (
                  <p className="text-slate-600 pl-1 leading-relaxed">
                    {c.explanation}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 3. Improved text */}
      {parsed.improvedText && (
        <div className="bg-indigo-50/70 p-3.5 rounded-xl border-l-4 border-indigo-500 border-y border-r border-indigo-200 space-y-2 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-indigo-900 uppercase tracking-wider flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-indigo-600" />
              Varianta recomandată
            </span>
          </div>
          <div className="text-xs sm:text-sm text-slate-800 bg-white/95 p-3 rounded-lg border border-indigo-100 whitespace-pre-wrap leading-relaxed font-sans">
            {parsed.improvedText}
          </div>
        </div>
      )}

      {/* 4. Tip */}
      {parsed.tip && (
        <div className="text-xs sm:text-sm text-amber-950 bg-amber-50/90 p-3.5 rounded-xl border border-amber-200 flex items-start gap-2.5 shadow-2xs">
          <Lightbulb className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold block text-xs uppercase tracking-wider text-amber-800 mb-0.5">Sfat pedagogic:</span>
            <span>{parsed.tip}</span>
          </div>
        </div>
      )}
    </div>
  );
};

export const SubmissionsView: React.FC = () => {
  const { currentUser, allSubmissions, reviewSubmission, deleteSubmission, refreshSubmissions } = useAuth();
  const { t } = useLanguage();
  const [selectedSubId, setSelectedSubId] = useState<string | null>(null);
  const [gradeInput, setGradeInput] = useState<number>(10);
  const [feedbackInput, setFeedbackInput] = useState('');
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Telegram Notifications State
  const [showTgModal, setShowTgModal] = useState(false);
  const [tgToken, setTgToken] = useState(() => getTelegramConfig().botToken);
  const [tgChatId, setTgChatId] = useState(() => getTelegramConfig().chatId);
  const [tgTestStatus, setTgTestStatus] = useState<{ ok: boolean; msg: string } | null>(null);
  const [isTgTesting, setIsTgTesting] = useState(false);
  const isTgReady = isTelegramConfigured();

  const isTeacher = currentUser?.role === 'teacher' || currentUser?.role === 'admin';

  // If student, filter by their own submissions (by userId or userEmail); if teacher/admin, show all
  const currentEmail = currentUser?.email?.toLowerCase();
  const visibleSubmissions = isTeacher
    ? allSubmissions
    : allSubmissions.filter(
        s => s.userId === currentUser?.id || (currentEmail && s.userEmail.toLowerCase() === currentEmail)
      );

  // Status filter state ('all' | 'pending' | 'reviewed')
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'reviewed'>('all');

  // Track explicit user collapse/expand toggles.
  // Default: reviewed submissions are collapsed, pending submissions are expanded.
  const [userToggledIds, setUserToggledIds] = useState<Record<string, boolean>>({});

  const isSubCollapsed = (sub: AssignmentSubmission): boolean => {
    if (userToggledIds[sub.id] !== undefined) {
      return userToggledIds[sub.id];
    }
    return sub.status === 'reviewed';
  };

  const toggleSubCollapse = (id: string, currentCollapsed: boolean) => {
    setUserToggledIds(prev => ({
      ...prev,
      [id]: !currentCollapsed
    }));
  };

  const collapseAll = () => {
    const next: Record<string, boolean> = {};
    visibleSubmissions.forEach(s => { next[s.id] = true; });
    setUserToggledIds(next);
  };

  const expandAll = () => {
    const next: Record<string, boolean> = {};
    visibleSubmissions.forEach(s => { next[s.id] = false; });
    setUserToggledIds(next);
  };

  const displayedSubmissions = visibleSubmissions.filter(s => {
    if (statusFilter === 'pending') return s.status === 'pending';
    if (statusFilter === 'reviewed') return s.status === 'reviewed';
    return true;
  });

  const pendingCount = visibleSubmissions.filter(s => s.status === 'pending').length;
  const reviewedCount = visibleSubmissions.filter(s => s.status === 'reviewed').length;
  const areAllCollapsed = displayedSubmissions.length > 0 && displayedSubmissions.every(s => isSubCollapsed(s));

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    try {
      await refreshSubmissions();
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleReview = (subId: string) => {
    reviewSubmission(subId, Number(gradeInput), feedbackInput);
    setSelectedSubId(null);
    setFeedbackInput('');
  };

  const handleSaveTelegram = () => {
    saveTelegramConfig(tgToken, tgChatId);
    setTgTestStatus({ ok: true, msg: 'Setările Telegram au fost salvate cu succes!' });
  };

  const handleTestTelegram = async () => {
    if (!tgToken.trim() || !tgChatId.trim()) {
      setTgTestStatus({ ok: false, msg: 'Introduceți mai întâi Bot Token și Chat ID.' });
      return;
    }
    saveTelegramConfig(tgToken, tgChatId);
    setIsTgTesting(true);
    setTgTestStatus(null);
    try {
      const ok = await sendTelegramMessage('🔔 <b>Test Notificare ANTEM</b>\n\nConexiunea la botul Telegram a fost configurată cu succes! Veți primi aici alerte când studenții trimit teme.');
      if (ok) {
        setTgTestStatus({ ok: true, msg: 'Mesaj de test expediat cu succes în Telegram!' });
      } else {
        setTgTestStatus({ ok: false, msg: 'Eroare la trimiterea mesajului. Verificați Token-ul și Chat ID-ul.' });
      }
    } catch (e: any) {
      setTgTestStatus({ ok: false, msg: e?.message || 'Eroare conexiune Telegram' });
    } finally {
      setIsTgTesting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-3 sm:px-4 py-4 pb-28">
      <div className="bg-white border border-slate-200 rounded-2xl p-5 mb-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-1">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900">
              {isTeacher ? t('subs_teacher_title') : t('subs_student_title')}
            </h1>
            <p className="text-sm text-slate-500 mt-0.5">
              {isTeacher ? t('subs_teacher_desc') : t('subs_student_desc')}
            </p>
          </div>
          <div className="flex items-center flex-wrap gap-2">
            {isTeacher && (
              <button
                type="button"
                onClick={() => setShowTgModal(true)}
                className={`px-3 py-1.5 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                  isTgReady
                    ? 'bg-sky-50 border-sky-200 text-sky-800 hover:bg-sky-100'
                    : 'bg-amber-50 border-amber-200 text-amber-800 hover:bg-amber-100'
                }`}
                title="Configurare Notificări Telegram"
              >
                <Bell className={`w-3.5 h-3.5 ${isTgReady ? 'text-sky-600' : 'text-amber-600'}`} />
                <span className="hidden sm:inline">{isTgReady ? 'Telegram: Activ' : 'Telegram Bot'}</span>
                <span className="sm:hidden">TG</span>
              </button>
            )}

            <button
              onClick={handleManualRefresh}
              disabled={isRefreshing}
              className="px-3 py-1.5 rounded-xl border border-slate-200 hover:border-slate-300 bg-slate-50 hover:bg-slate-100 text-xs font-semibold text-slate-700 flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-60"
              title="Sincronizează cu baza de date"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-blue-600' : 'text-slate-500'}`} />
              <span>{isRefreshing ? 'Sincronizare...' : 'Reîmprospătează'}</span>
            </button>
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
        </div>
      </div>

      {/* Telegram Configuration Modal for Teachers/Admins */}
      {showTgModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center">
                  <Bell className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">Notificări Telegram</h3>
                  <p className="text-xs text-slate-500">Primiți alerte pe telefon când studenții trimit teme</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowTgModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs text-slate-600">
              <div>
                <label className="block font-bold text-slate-800 mb-1">
                  1. Telegram Bot Token:
                </label>
                <input
                  type="text"
                  value={tgToken}
                  onChange={e => setTgToken(e.target.value)}
                  placeholder="123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
                <span className="text-[11px] text-slate-400 mt-0.5 block">
                  Obțineți de la <b>@BotFather</b> în Telegram (comanda /newbot)
                </span>
              </div>

              <div>
                <label className="block font-bold text-slate-800 mb-1">
                  2. Chat ID (ID-ul dvs. personal sau grup):
                </label>
                <input
                  type="text"
                  value={tgChatId}
                  onChange={e => setTgChatId(e.target.value)}
                  placeholder="Ex: 987654321 sau -100123456789"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
                <span className="text-[11px] text-slate-400 mt-0.5 block">
                  Aflați ID-ul scriind botului <b>@userinfobot</b> în Telegram
                </span>
              </div>

              {tgTestStatus && (
                <div className={`p-3 rounded-xl border text-xs flex items-start gap-2 ${
                  tgTestStatus.ok ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-rose-50 border-rose-200 text-rose-800'
                }`}>
                  {tgTestStatus.ok ? <Check className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600" /> : <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />}
                  <span>{tgTestStatus.msg}</span>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-slate-100 gap-2">
              <button
                type="button"
                onClick={handleTestTelegram}
                disabled={isTgTesting}
                className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all cursor-pointer disabled:opacity-50"
              >
                {isTgTesting ? 'Se expediază...' : 'Trimite mesaj de test'}
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowTgModal(false)}
                  className="px-3.5 py-2 rounded-xl border border-slate-200 text-slate-600 text-xs font-semibold hover:bg-slate-50 cursor-pointer"
                >
                  Închide
                </button>
                <button
                  type="button"
                  onClick={handleSaveTelegram}
                  className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold shadow-sm transition-all cursor-pointer"
                >
                  Salvează setările
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Status Filter & Collapse All Toolbar */}
      {visibleSubmissions.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2.5 mb-4 px-1">
          {/* Status filter pills */}
          <div className="flex items-center gap-1.5 bg-slate-100/90 p-1 rounded-xl">
            <button
              type="button"
              onClick={() => setStatusFilter('all')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                statusFilter === 'all'
                  ? 'bg-white text-blue-600 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Toate ({visibleSubmissions.length})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('pending')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                statusFilter === 'pending'
                  ? 'bg-white text-amber-700 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Clock className="w-3.5 h-3.5 text-amber-600" />
              În așteptare ({pendingCount})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('reviewed')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                statusFilter === 'reviewed'
                  ? 'bg-white text-emerald-700 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              Verificate ({reviewedCount})
            </button>
          </div>

          {/* Collapse / Expand all toggle button */}
          <button
            type="button"
            onClick={areAllCollapsed ? expandAll : collapseAll}
            className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center gap-1.5 transition-all shadow-2xs cursor-pointer"
          >
            <ChevronsUpDown className="w-3.5 h-3.5 text-slate-500" />
            <span>{areAllCollapsed ? 'Extinde toate' : 'Restrânge toate'}</span>
          </button>
        </div>
      )}

      {visibleSubmissions.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center text-slate-500 shadow-2xs">
          <MessageSquare className="w-10 h-10 text-slate-300 mx-auto mb-2" />
          <p className="font-semibold text-slate-700">{t('subs_empty_title')}</p>
          <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
            {t('subs_empty_desc')}
          </p>
        </div>
      ) : displayedSubmissions.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center text-slate-500 shadow-2xs">
          <p className="font-semibold text-slate-700 text-sm">Nu există teme în categoria selectată.</p>
          <button
            type="button"
            onClick={() => setStatusFilter('all')}
            className="mt-2 text-xs font-bold text-blue-600 hover:underline cursor-pointer"
          >
            Afișează toate temele
          </button>
        </div>
      ) : (
        <div className="space-y-3 sm:space-y-4">
          {displayedSubmissions.map(sub => {
            const isReviewed = sub.status === 'reviewed';
            const collapsed = isSubCollapsed(sub);

            return (
              <div
                key={sub.id}
                className={`bg-white border rounded-2xl shadow-xs transition-all overflow-hidden ${
                  collapsed ? 'border-slate-200 hover:border-slate-300' : 'border-slate-300 ring-1 ring-slate-200'
                }`}
              >
                {/* Header (Click to toggle collapse / expand) */}
                <div
                  onClick={() => toggleSubCollapse(sub.id, collapsed)}
                  className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 cursor-pointer select-none hover:bg-slate-50/70 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1.5">
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
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-bold text-slate-900 truncate">
                        {sub.activityTitle}
                      </h3>
                    </div>

                    {/* Collapsed 1-line teaser */}
                    {collapsed && (
                      <p className="text-xs text-slate-500 truncate mt-1 italic font-sans bg-slate-50/90 px-2.5 py-1 rounded-lg border border-slate-100/80">
                        „{sub.submissionText.replace(/\s+/g, ' ').trim()}”
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`inline-flex items-center gap-1 text-xs font-bold px-3 py-1 rounded-full shrink-0 w-fit ${
                      isReviewed
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-amber-100 text-amber-800'
                    }`}>
                      {isReviewed ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Clock className="w-3.5 h-3.5" />}
                      {isReviewed ? `Verificat • Nota ${sub.grade}/10` : 'În așteptare'}
                    </span>

                    {(sub.userId === currentUser?.id || currentUser?.role === 'admin') && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (window.confirm(t('subs_confirm_delete'))) {
                            deleteSubmission(sub.id);
                          }
                        }}
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                        title={t('subs_btn_delete')}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}

                    <div
                      className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg bg-slate-100/80 transition-colors"
                      title={collapsed ? 'Extinde detalii' : 'Restrânge'}
                    >
                      {collapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
                    </div>
                  </div>
                </div>

                {/* Expanded Card Body */}
                {!collapsed && (
                  <div className="px-4 pb-4 sm:px-5 sm:pb-5 pt-2 border-t border-slate-100 space-y-3 animate-fadeIn">
                    {/* Student's answer */}
                    <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-sm text-slate-800 whitespace-pre-wrap">
                      <span className="text-xs font-bold text-slate-500 block mb-1">Răspunsul studentului:</span>
                      {sub.submissionText}
                    </div>

                    {/* AI Evaluation details if available */}
                    {sub.aiEvaluation && (
                      <div className="bg-purple-50/50 p-3.5 rounded-xl border border-purple-200 text-xs space-y-2">
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
                      <div className="bg-emerald-50/70 p-4 rounded-xl border border-emerald-200 text-sm text-emerald-950 space-y-2">
                        <span className="text-xs font-bold text-emerald-800 uppercase tracking-wider flex items-center gap-1.5">
                          <Award className="w-4 h-4 text-emerald-600" /> {t('subs_feedback_label')}
                        </span>
                        <FormattedFeedback feedback={sub.teacherFeedback} />
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
                                rows={5}
                                value={feedbackInput}
                                onChange={e => setFeedbackInput(e.target.value)}
                                placeholder={t('subs_feedback_ph')}
                                className="w-full text-sm p-2.5 bg-white border border-purple-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-400 font-mono text-xs"
                              />
                            </div>

                            {feedbackInput.trim() && (
                              <div className="pt-1">
                                <span className="text-[11px] font-bold text-purple-800 uppercase tracking-wider block mb-1.5 flex items-center gap-1">
                                  <Eye className="w-3.5 h-3.5 text-purple-600" />
                                  Previzualizare pentru student:
                                </span>
                                <div className="bg-emerald-50/70 p-3.5 rounded-xl border border-emerald-200">
                                  <FormattedFeedback feedback={feedbackInput} />
                                </div>
                              </div>
                            )}
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

                    {/* Bottom collapse button */}
                    <div className="flex justify-end pt-2 border-t border-slate-100">
                      <button
                        type="button"
                        onClick={() => toggleSubCollapse(sub.id, false)}
                        className="text-xs font-semibold text-slate-500 hover:text-slate-800 flex items-center gap-1 px-2.5 py-1 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
                      >
                        <ChevronUp className="w-3.5 h-3.5" />
                        <span>Restrânge</span>
                      </button>
                    </div>
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

