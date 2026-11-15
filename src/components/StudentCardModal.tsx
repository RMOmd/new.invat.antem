import React, { useState, useEffect } from 'react';
import { CourseData, ActivityProgress, AssignmentSubmission } from '../types/course';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import {
  User,
  X,
  GraduationCap,
  Award,
  CheckCircle2,
  Clock,
  BookOpen,
  Send,
  AlertCircle,
  Search,
  Calendar,
  ChevronRight,
  Loader2,
  Info
} from 'lucide-react';

export interface StudentCardTarget {
  id: string;
  name: string;
  email: string;
  role?: string;
  createdAt?: string;
}

interface StudentCardModalProps {
  student: StudentCardTarget;
  courseData: CourseData;
  onClose: () => void;
  onSelectActivity?: (activityId: string) => void;
}

export const StudentCardModal: React.FC<StudentCardModalProps> = ({
  student,
  courseData,
  onClose,
  onSelectActivity
}) => {
  const { getStudentProgress, allSubmissions } = useAuth();
  const { t } = useLanguage();

  const [loading, setLoading] = useState(true);
  const [progressMap, setProgressMap] = useState<Record<string, ActivityProgress>>({});
  const [activeTab, setActiveTab] = useState<'exercises' | 'submissions' | 'weak'>('exercises');
  const [searchFilter, setSearchFilter] = useState('');

  // Fetch student progress on mount
  useEffect(() => {
    let isMounted = true;
    setLoading(true);

    getStudentProgress(student.id)
      .then(map => {
        if (isMounted) {
          setProgressMap(map || {});
          setLoading(false);
        }
      })
      .catch(err => {
        console.warn('Student progress fetch error:', err);
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [student.id, getStudentProgress]);

  // Handle ESC key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Map of all course activities with their section title
  const flatActivities = React.useMemo(() => {
    const list: { sectionId: string; sectionTitle: string; activity: any }[] = [];
    courseData.sections.forEach(s => {
      s.activities.forEach(a => {
        list.push({
          sectionId: s.sectionId,
          sectionTitle: s.title,
          activity: a
        });
      });
    });
    return list;
  }, [courseData]);

  const totalCourseActivities = flatActivities.length;

  // Completed activities
  const completedEntries = Object.values(progressMap).filter(p => p.completed);
  const completedCount = completedEntries.length;
  const overallPercent = totalCourseActivities > 0
    ? Math.round((completedCount / totalCourseActivities) * 100)
    : 0;

  // Average score on interactive exercises
  const averageScore = completedEntries.length > 0
    ? Math.round(completedEntries.reduce((acc, p) => acc + (p.score || 0), 0) / completedEntries.length)
    : 0;

  // Total correct items in gaps / quizzes
  const totalCorrectAnswers = completedEntries.reduce((acc, p) => acc + (p.correctCount || 0), 0);

  // Submissions sent by this student
  const studentEmailClean = student.email.trim().toLowerCase();
  const studentSubmissions: AssignmentSubmission[] = allSubmissions.filter(
    s => s.userId === student.id || (s.userEmail && s.userEmail.trim().toLowerCase() === studentEmailClean)
  );

  // Reviewed submissions with grades
  const reviewedSubmissions = studentSubmissions.filter(s => s.status === 'reviewed' && s.grade !== undefined);
  const averageGrade = reviewedSubmissions.length > 0
    ? (reviewedSubmissions.reduce((acc, s) => acc + (s.grade || 0), 0) / reviewedSubmissions.length).toFixed(1)
    : null;

  // Weak activities (score < 80%)
  const weakEntries = completedEntries.filter(p => (p.score || 0) < 80);

  // Filter completed activities for list
  const filteredCompleted = flatActivities.filter(item => {
    const p = progressMap[item.activity.id];
    if (!p || !p.completed) return false;
    if (!searchFilter.trim()) return true;
    const q = searchFilter.toLowerCase();
    return (
      item.activity.title.toLowerCase().includes(q) ||
      item.activity.id.toLowerCase().includes(q) ||
      item.sectionTitle.toLowerCase().includes(q)
    );
  });

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-2.5 sm:p-5 overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-3xl w-full max-h-[92vh] flex flex-col shadow-2xl border border-slate-200 animate-fadeIn overflow-hidden">
        {/* Header with Student Identity */}
        <div className="p-4 sm:p-6 bg-gradient-to-r from-slate-900 via-blue-950 to-indigo-950 text-white relative shrink-0">
          {/* Close button */}
          <button
            type="button"
            onClick={onClose}
            className="absolute top-3.5 right-3.5 p-2 rounded-full text-slate-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            title={t('btn_close')}
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-start sm:items-center gap-3 sm:gap-4">
            <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-lg sm:text-2xl font-black shadow-lg border border-white/20 shrink-0">
              {student.name ? student.name.charAt(0).toUpperCase() : 'U'}
            </div>

            <div className="min-w-0 flex-1 pr-6">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <h2 className="text-lg sm:text-2xl font-extrabold tracking-tight truncate text-white">
                  {student.name}
                </h2>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                  student.role === 'admin'
                    ? 'bg-rose-500/30 text-rose-300 border border-rose-500/50'
                    : student.role === 'teacher'
                    ? 'bg-purple-500/30 text-purple-300 border border-purple-500/50'
                    : student.role === 'demo'
                    ? 'bg-amber-500/30 text-amber-300 border border-amber-500/50'
                    : 'bg-blue-500/30 text-blue-300 border border-blue-500/50'
                }`}>
                  {student.role === 'admin'
                    ? t('role_admin')
                    : student.role === 'teacher'
                    ? t('role_teacher')
                    : student.role === 'demo'
                    ? t('role_demo')
                    : t('role_student')}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-xs text-blue-200/90 font-mono">
                <span className="truncate">{student.email}</span>
                {student.createdAt && (
                  <span className="flex items-center gap-1 text-[11px] text-slate-300 font-sans">
                    <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span>{t('registered_at')} {new Date(student.createdAt).toLocaleDateString()}</span>
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Subtitle */}
          <div className="mt-3 pt-2.5 border-t border-white/10 flex items-center justify-between text-[11px] sm:text-xs text-blue-200">
            <span className="truncate mr-2">{t('student_card_subtitle')}</span>
            <span className="font-semibold text-amber-300 shrink-0">Nivel A1+ • ANTEM</span>
          </div>
        </div>

        {/* 4 Metric KPI Cards */}
        <div className="p-3 sm:p-5 bg-slate-50 border-b border-slate-200/80 shrink-0">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
            {/* KPI 1: Course Progress */}
            <div className="bg-white p-2.5 sm:p-3 rounded-2xl border border-slate-200 shadow-2xs">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5 truncate">
                {t('student_card_kpi_progress')}
              </span>
              <div className="flex items-baseline gap-1">
                <span className="text-lg sm:text-2xl font-black text-blue-600">{overallPercent}%</span>
                <span className="text-[11px] sm:text-xs text-slate-500 font-semibold truncate">({completedCount}/{totalCourseActivities})</span>
              </div>
              <div className="w-full bg-slate-100 h-1.5 rounded-full mt-2 overflow-hidden">
                <div
                  className="bg-blue-600 h-1.5 rounded-full transition-all"
                  style={{ width: `${Math.min(100, overallPercent)}%` }}
                />
              </div>
            </div>

            {/* KPI 2: Average Score */}
            <div className="bg-white p-2.5 sm:p-3 rounded-2xl border border-slate-200 shadow-2xs">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5 truncate">
                {t('student_card_kpi_avg_score')}
              </span>
              <div className="flex items-baseline gap-1">
                <span className={`text-lg sm:text-2xl font-black ${
                  averageScore >= 80 ? 'text-emerald-600' : averageScore >= 60 ? 'text-amber-600' : 'text-slate-700'
                }`}>
                  {completedCount > 0 ? `${averageScore}%` : '—'}
                </span>
                <span className="text-[11px] sm:text-xs text-slate-400 font-semibold">{t('stats_kpi_accuracy')}</span>
              </div>
              <span className="text-[10px] text-slate-500 mt-1 block truncate">
                {t('student_card_lessons_evaluated', { count: completedCount })}
              </span>
            </div>

            {/* KPI 3: Average Grade on Essays */}
            <div className="bg-white p-2.5 sm:p-3 rounded-2xl border border-slate-200 shadow-2xs">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5 truncate">
                {t('student_card_kpi_avg_grade')}
              </span>
              <div className="flex items-baseline gap-1">
                <span className="text-lg sm:text-2xl font-black text-purple-600">
                  {averageGrade ? `${averageGrade}/10` : '—'}
                </span>
              </div>
              <span className="text-[10px] text-slate-500 mt-1 block truncate">
                {t('student_card_submissions_noted', { reviewed: reviewedSubmissions.length, total: studentSubmissions.length })}
              </span>
            </div>

            {/* KPI 4: Correct Answers */}
            <div className="bg-white p-2.5 sm:p-3 rounded-2xl border border-slate-200 shadow-2xs">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5 truncate">
                {t('student_card_kpi_answers')}
              </span>
              <div className="flex items-baseline gap-1">
                <span className="text-lg sm:text-2xl font-black text-emerald-600">
                  {totalCorrectAnswers}
                </span>
                <span className="text-[11px] sm:text-xs text-slate-400 font-semibold">{t('stats_kpi_correct_answers')}</span>
              </div>
              <span className="text-[10px] text-slate-500 mt-1 block truncate">
                {t('student_card_gaps_solved')}
              </span>
            </div>
          </div>
        </div>

        {/* Tab Navigation (Responsive, horizontally scrollable on mobile, no clipping) */}
        <div className="px-3 sm:px-5 pt-2 border-b border-slate-200 flex gap-2 sm:gap-4 shrink-0 bg-white overflow-x-auto no-scrollbar">
          <button
            type="button"
            onClick={() => setActiveTab('exercises')}
            className={`pb-2.5 px-2 text-xs sm:text-sm font-bold border-b-2 transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0 ${
              activeTab === 'exercises'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <BookOpen className="w-4 h-4" />
            <span className="hidden sm:inline">{t('student_card_tab_exercises')}</span>
            <span className="sm:hidden">{t('student_card_tab_exercises_short')}</span>
            <span className="text-xs px-1.5 py-0.2 rounded-full bg-slate-100 text-slate-600 font-semibold">
              {completedCount}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('submissions')}
            className={`pb-2.5 px-2 text-xs sm:text-sm font-bold border-b-2 transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0 ${
              activeTab === 'submissions'
                ? 'border-purple-600 text-purple-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Send className="w-4 h-4" />
            <span className="hidden sm:inline">{t('student_card_tab_submissions')}</span>
            <span className="sm:hidden">{t('student_card_tab_submissions_short')}</span>
            <span className="text-xs px-1.5 py-0.2 rounded-full bg-purple-100 text-purple-700 font-semibold">
              {studentSubmissions.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('weak')}
            className={`pb-2.5 px-2 text-xs sm:text-sm font-bold border-b-2 transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0 ${
              activeTab === 'weak'
                ? 'border-rose-600 text-rose-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <AlertCircle className="w-4 h-4" />
            <span className="hidden sm:inline">{t('student_card_tab_weak')}</span>
            <span className="sm:hidden">{t('student_card_tab_weak_short')}</span>
            <span className="text-xs px-1.5 py-0.2 rounded-full bg-rose-100 text-rose-700 font-semibold">
              {weakEntries.length}
            </span>
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-3.5 sm:p-5">
          {loading ? (
            <div className="py-12 flex flex-col items-center justify-center text-slate-500">
              <Loader2 className="w-8 h-8 text-blue-600 animate-spin mb-2" />
              <span className="text-xs font-semibold">{t('student_card_loading')}</span>
            </div>
          ) : (
            <>
              {/* TAB 1: COMPLETED EXERCISES */}
              {activeTab === 'exercises' && (
                <div className="space-y-3">
                  {/* Search within completed */}
                  <div className="relative mb-3">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={searchFilter}
                      onChange={e => setSearchFilter(e.target.value)}
                      placeholder={t('student_card_search_ph')}
                      className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900"
                    />
                  </div>

                  {filteredCompleted.length === 0 ? (
                    <div className="p-8 text-center bg-slate-50 rounded-2xl border border-slate-200 text-slate-500 text-xs">
                      {searchFilter ? t('student_card_no_search_results') : t('student_card_no_exercises')}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {filteredCompleted.map(({ sectionTitle, activity }) => {
                        const p = progressMap[activity.id];
                        const score = p?.score || 0;
                        return (
                          <div
                            key={activity.id}
                            className="p-3 bg-white border border-slate-200/90 rounded-2xl flex items-center justify-between gap-3 hover:border-blue-300 transition-colors shadow-2xs"
                          >
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 mb-0.5">
                                <span className="text-[10px] font-bold text-slate-400 font-mono">
                                  #{activity.id}
                                </span>
                                <span className="text-[11px] font-semibold text-blue-700 bg-blue-50 px-2 py-0.2 rounded truncate max-w-[200px]">
                                  {sectionTitle}
                                </span>
                                <span className="text-[10px] font-bold uppercase text-slate-500 px-1.5 py-0.2 bg-slate-100 rounded">
                                  {activity.type}
                                </span>
                              </div>
                              <h4 className="text-xs sm:text-sm font-bold text-slate-900 truncate">
                                {activity.title}
                              </h4>
                              {p?.lastAttemptAt && (
                                <span className="text-[10px] text-slate-400 block mt-0.5">
                                  {t('student_card_completed_at')} {new Date(p.lastAttemptAt).toLocaleString()}
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                              <span className={`text-xs font-black px-2.5 py-1 rounded-xl ${
                                score >= 90
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : score >= 70
                                  ? 'bg-blue-100 text-blue-800'
                                  : score >= 50
                                  ? 'bg-amber-100 text-amber-800'
                                  : 'bg-rose-100 text-rose-800'
                              }`}>
                                {score}%
                              </span>

                              {onSelectActivity && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    onSelectActivity(activity.id);
                                    onClose();
                                  }}
                                  className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors cursor-pointer"
                                  title={t('student_card_open_act')}
                                >
                                  <ChevronRight className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* TAB 2: WRITTEN ASSIGNMENTS TO TEACHER */}
              {activeTab === 'submissions' && (
                <div className="space-y-3">
                  {studentSubmissions.length === 0 ? (
                    <div className="p-8 text-center bg-slate-50 rounded-2xl border border-slate-200 text-slate-500 text-xs">
                      {t('student_card_no_submissions')}
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {studentSubmissions.map(sub => {
                        const isReviewed = sub.status === 'reviewed';
                        return (
                          <div
                            key={sub.id}
                            className="p-4 bg-white border border-slate-200 rounded-2xl shadow-2xs space-y-2.5"
                          >
                            <div className="flex items-center justify-between gap-2 flex-wrap">
                              <div>
                                <span className="text-[10px] font-bold text-slate-400 font-mono">
                                  #{sub.activityId}
                                </span>
                                <h4 className="text-xs sm:text-sm font-bold text-slate-900">
                                  {sub.activityTitle}
                                </h4>
                              </div>

                              <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                                isReviewed
                                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                  : 'bg-amber-100 text-amber-800 border border-amber-200'
                              }`}>
                                {isReviewed
                                  ? `${t('subs_status_reviewed')} • ${t('subs_grade_label')} ${sub.grade}/10`
                                  : t('subs_status_pending')}
                              </span>
                            </div>

                            {/* Student text */}
                            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/80 text-xs text-slate-800 whitespace-pre-wrap leading-relaxed font-sans">
                              {sub.submissionText}
                            </div>

                            {/* Teacher feedback if reviewed */}
                            {sub.teacherFeedback && (
                              <div className="bg-emerald-50/70 p-3 rounded-xl border border-emerald-200 text-xs text-emerald-950 space-y-1">
                                <span className="font-bold text-[11px] uppercase tracking-wider text-emerald-800 block">
                                  {t('subs_feedback_label')}
                                </span>
                                <p className="leading-relaxed whitespace-pre-wrap font-sans">
                                  {sub.teacherFeedback}
                                </p>
                              </div>
                            )}

                            <span className="text-[10px] text-slate-400 block pt-1">
                              {t('student_card_submitted_at')} {new Date(sub.createdAt).toLocaleString()}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* TAB 3: WEAK AREAS (<80%) */}
              {activeTab === 'weak' && (
                <div className="space-y-3">
                  {completedCount === 0 ? (
                    /* Student hasn't started lessons yet */
                    <div className="p-8 text-center bg-slate-50 rounded-2xl border border-slate-200 text-slate-600 text-xs space-y-1.5">
                      <Info className="w-8 h-8 text-blue-500 mx-auto mb-1" />
                      <span className="font-bold block text-sm text-slate-900">
                        {t('student_card_not_started_title')}
                      </span>
                      <p className="text-slate-500 max-w-sm mx-auto leading-relaxed">
                        {t('student_card_not_started_desc')}
                      </p>
                    </div>
                  ) : weakEntries.length === 0 ? (
                    /* Completed lessons exist and all >= 80% */
                    <div className="p-8 text-center bg-emerald-50 rounded-2xl border border-emerald-200 text-emerald-900 text-xs space-y-1">
                      <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto mb-1" />
                      <span className="font-bold block text-sm">{t('student_card_no_weak_title')}</span>
                      <span>{t('student_card_no_weak')}</span>
                    </div>
                  ) : (
                    /* Weak activities list */
                    <div className="space-y-2">
                      <p className="text-xs text-slate-500 mb-2">
                        {t('student_card_weak_desc')}
                      </p>
                      {weakEntries.map(p => {
                        const actInfo = flatActivities.find(item => item.activity.id === p.activityId);
                        return (
                          <div
                            key={p.activityId}
                            className="p-3 bg-rose-50/60 border border-rose-200 rounded-2xl flex items-center justify-between gap-3"
                          >
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5 mb-0.5">
                                <span className="text-[10px] font-bold text-rose-500 font-mono">
                                  #{p.activityId}
                                </span>
                                {actInfo && (
                                  <span className="text-[10px] font-semibold text-rose-800 truncate">
                                    {actInfo.sectionTitle}
                                  </span>
                                )}
                              </div>
                              <h4 className="text-xs sm:text-sm font-bold text-slate-900 truncate">
                                {actInfo?.activity.title || `Activitatea ${p.activityId}`}
                              </h4>
                              {p.lastAttemptAt && (
                                <span className="text-[10px] text-slate-400 block">
                                  {t('student_card_last_attempt')} {new Date(p.lastAttemptAt).toLocaleString()}
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                              <span className="text-xs font-black px-2.5 py-1 rounded-xl bg-rose-100 text-rose-800 border border-rose-200">
                                {p.score || 0}%
                              </span>

                              {onSelectActivity && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    onSelectActivity(p.activityId);
                                    onClose();
                                  }}
                                  className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-white transition-colors cursor-pointer"
                                  title={t('student_card_open_act')}
                                >
                                  <ChevronRight className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 sm:p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-3 shrink-0">
          <span className="text-[11px] sm:text-xs text-slate-500 font-medium truncate">
            {t('student_card_footer_mode')}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-xs transition-colors cursor-pointer shrink-0"
          >
            {t('btn_close')}
          </button>
        </div>
      </div>
    </div>
  );
};
