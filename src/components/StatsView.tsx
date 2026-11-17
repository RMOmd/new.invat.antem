import React, { useState, useMemo } from 'react';
import { CourseData } from '../types/course';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import {
  Trophy,
  CheckCircle,
  Target,
  Clock,
  ArrowRight,
  LogOut,
  ChevronDown,
  Layers,
  Search,
  BookOpen
} from 'lucide-react';

interface StatsViewProps {
  courseData: CourseData;
  onSelectActivityById: (id: string) => void;
}

export const StatsView: React.FC<StatsViewProps> = ({ courseData, onSelectActivityById }) => {
  const { currentUser, allProgress, logout } = useAuth();
  const { t } = useLanguage();

  // Calculate aggregate stats
  const allActivities = useMemo(() => courseData.sections.flatMap(s => s.activities), [courseData.sections]);
  const totalActivities = allActivities.length;

  const completedActivities = useMemo(
    () => Object.values(allProgress).filter(p => p.completed),
    [allProgress]
  );
  const completedCount = completedActivities.length;
  const overallPercent = totalActivities > 0 ? Math.round((completedCount / totalActivities) * 100) : 0;

  const averageScore = completedActivities.length > 0
    ? Math.round(completedActivities.reduce((acc, p) => acc + (p.score || 0), 0) / completedActivities.length)
    : 0;

  const totalGapsCompleted = completedActivities.reduce((acc, p) => acc + (p.correctCount || 0), 0);

  // Weak activities (score < 80%) for error review
  const needsReview = useMemo(
    () => completedActivities.filter(p => p.score < 80),
    [completedActivities]
  );

  // Group progress by sections (chapters)
  const sectionStats = useMemo(() => {
    return courseData.sections.map((sec, secIdx) => {
      const completedInSec = sec.activities
        .filter(act => allProgress[act.id]?.completed)
        .map(act => ({
          activity: act,
          progress: allProgress[act.id]
        }));

      const totalCount = sec.activities.length;
      const count = completedInSec.length;
      const percent = totalCount > 0 ? Math.round((count / totalCount) * 100) : 0;
      const avgScore = count > 0
        ? Math.round(completedInSec.reduce((sum, item) => sum + (item.progress.score || 0), 0) / count)
        : 0;

      return {
        sectionId: sec.sectionId,
        title: sec.title,
        secIdx,
        totalCount,
        completedCount: count,
        percent,
        avgScore,
        completedList: completedInSec
      };
    });
  }, [courseData.sections, allProgress]);

  // Section collapse state: default to expanding the first section that has completed activities
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    let firstFound = false;
    courseData.sections.forEach(sec => {
      const hasCompleted = sec.activities.some(act => allProgress[act.id]?.completed);
      if (hasCompleted && !firstFound) {
        init[sec.sectionId] = true;
        firstFound = true;
      }
    });
    return init;
  });

  const [filterCompletedOnly, setFilterCompletedOnly] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');

  const toggleSection = (sectionId: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [sectionId]: !prev[sectionId]
    }));
  };

  const expandAll = () => {
    const all: Record<string, boolean> = {};
    courseData.sections.forEach(sec => {
      all[sec.sectionId] = true;
    });
    setExpandedSections(all);
  };

  const collapseAll = () => {
    setExpandedSections({});
  };

  // Filter sections according to toggle and search query
  const filteredSections = useMemo(() => {
    return sectionStats.filter(sec => {
      if (filterCompletedOnly && sec.completedCount === 0) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesSectionTitle = sec.title.toLowerCase().includes(q);
        const matchesActivity = sec.completedList.some(item =>
          item.activity.title.toLowerCase().includes(q) || item.activity.id.includes(q)
        );
        return matchesSectionTitle || matchesActivity;
      }
      return true;
    });
  }, [sectionStats, filterCompletedOnly, searchQuery]);

  return (
    <div className="max-w-4xl mx-auto px-3 sm:px-4 py-4 pb-28">
      {/* Header Profile & KPIs */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 mb-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-2">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900">
                {currentUser?.name || t('role_student')}
              </h1>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                currentUser?.role === 'admin'
                  ? 'bg-rose-100 text-rose-700'
                  : currentUser?.role === 'teacher'
                  ? 'bg-purple-100 text-purple-700'
                  : 'bg-blue-100 text-blue-700'
              }`}>
                {currentUser?.role === 'admin'
                  ? t('role_admin')
                  : currentUser?.role === 'teacher'
                  ? t('role_teacher')
                  : t('role_student')}
              </span>
            </div>
            <p className="text-xs text-slate-500 font-mono mt-0.5">{currentUser?.email}</p>
          </div>
          <button
            type="button"
            onClick={logout}
            className="self-start sm:self-auto inline-flex items-center gap-1.5 px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-bold transition-colors cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            {t('btn_logout')}
          </button>
        </div>
        <p className="text-sm text-slate-500">
          {t('stats_header_subtitle')}
        </p>

        {/* 4 Key KPI Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5">
          <div className="p-3.5 bg-blue-50/70 border border-blue-200 rounded-xl">
            <div className="flex items-center gap-1.5 text-blue-700 text-xs font-semibold mb-1">
              <CheckCircle className="w-4 h-4" /> {t('stats_kpi_completed')}
            </div>
            <div className="text-2xl font-extrabold text-blue-900">
              {completedCount} <span className="text-xs font-normal text-slate-500">/ {totalActivities}</span>
            </div>
            <div className="text-[11px] text-blue-600 mt-0.5">{overallPercent}% {t('stats_kpi_of_course')}</div>
          </div>

          <div className="p-3.5 bg-emerald-50/70 border border-emerald-200 rounded-xl">
            <div className="flex items-center gap-1.5 text-emerald-700 text-xs font-semibold mb-1">
              <Trophy className="w-4 h-4" /> {t('stats_kpi_avg_score')}
            </div>
            <div className="text-2xl font-extrabold text-emerald-900">
              {averageScore}%
            </div>
            <div className="text-[11px] text-emerald-600 mt-0.5">{t('stats_kpi_accuracy')}</div>
          </div>

          <div className="p-3.5 bg-indigo-50/70 border border-indigo-200 rounded-xl">
            <div className="flex items-center gap-1.5 text-indigo-700 text-xs font-semibold mb-1">
              <Target className="w-4 h-4" /> {t('stats_kpi_correct_answers')}
            </div>
            <div className="text-2xl font-extrabold text-indigo-900">
              {totalGapsCompleted}
            </div>
            <div className="text-[11px] text-indigo-600 mt-0.5">{t('stats_kpi_gaps_filled')}</div>
          </div>

          <div className="p-3.5 bg-purple-50/70 border border-purple-200 rounded-xl">
            <div className="flex items-center gap-1.5 text-purple-700 text-xs font-semibold mb-1">
              <Clock className="w-4 h-4" /> {t('stats_kpi_current_level')}
            </div>
            <div className="text-2xl font-extrabold text-purple-900">
              A1+
            </div>
            <div className="text-[11px] text-purple-600 mt-0.5">Antem Moldova</div>
          </div>
        </div>
      </div>

      {/* Review mistakes / Need practice (< 80%) */}
      {needsReview.length > 0 && (
        <div className="bg-amber-50/70 border border-amber-200 rounded-2xl p-5 mb-6 shadow-xs">
          <h2 className="text-base font-bold text-amber-900 mb-2 flex items-center gap-2">
            <span>⚠️</span> {t('stats_weak_title')} ({needsReview.length})
          </h2>
          <div className="space-y-2 mt-3">
            {needsReview.map(p => {
              const act = allActivities.find(a => a.id === p.activityId);
              return (
                <div
                  key={p.activityId}
                  className="bg-white p-3 rounded-xl border border-amber-200 flex items-center justify-between gap-3 shadow-2xs"
                >
                  <div className="min-w-0">
                    <span className="text-xs font-mono text-slate-400">#{p.activityId}</span>
                    <span className="text-sm font-semibold text-slate-800 block truncate">
                      {act?.title || `Lecția #${p.activityId}`}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-xs font-bold px-2 py-0.5 bg-amber-100 text-amber-800 rounded-md">
                      {p.score}%
                    </span>
                    <button
                      type="button"
                      onClick={() => onSelectActivityById(p.activityId)}
                      className="text-xs font-bold px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg flex items-center gap-1 transition-colors cursor-pointer"
                    >
                      {t('stats_btn_repeat')} <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Grouped Progress & History by Chapters (Collapsible Accordion) */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 pb-3 border-b border-slate-100">
          <div>
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Layers className="w-4 h-4 text-blue-600" />
              <span>{t('stats_sections_title')}</span>
              <span className="text-xs font-semibold text-slate-500 font-mono">
                ({completedCount} {t('stats_kpi_of_course')})
              </span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Нажмите на главу, чтобы развернуть список завершённых уроков и оценок
            </p>
          </div>

          {/* Action buttons: Expand all / Collapse all & Filter */}
          <div className="flex items-center flex-wrap gap-2">
            <button
              type="button"
              onClick={expandAll}
              className="px-2.5 py-1 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors cursor-pointer"
            >
              {t('stats_expand_all')}
            </button>
            <button
              type="button"
              onClick={collapseAll}
              className="px-2.5 py-1 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors cursor-pointer"
            >
              {t('stats_collapse_all')}
            </button>
            <button
              type="button"
              onClick={() => setFilterCompletedOnly(!filterCompletedOnly)}
              className={`px-2.5 py-1 text-xs font-semibold rounded-lg border transition-colors cursor-pointer ${
                filterCompletedOnly
                  ? 'bg-blue-50 border-blue-200 text-blue-700'
                  : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              {filterCompletedOnly ? t('stats_filter_completed_only') : t('stats_filter_all_units')}
            </button>
          </div>
        </div>

        {/* Quick search input */}
        <div className="relative mb-4">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Поиск по названию главы или урока..."
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
          />
        </div>

        {filteredSections.length === 0 ? (
          <div className="py-10 text-center text-slate-500">
            <BookOpen className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="text-sm font-medium">
              {searchQuery.trim()
                ? 'Ничего не найдено по вашему запросу'
                : 'Нет глав с выполненными уроками'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredSections.map(sec => {
              const isExpanded = !!expandedSections[sec.sectionId] || !!searchQuery.trim();
              const is100Percent = sec.completedCount === sec.totalCount && sec.totalCount > 0;
              const hasProgress = sec.completedCount > 0;

              return (
                <div
                  key={sec.sectionId}
                  className="border border-slate-200 rounded-xl overflow-hidden transition-all bg-white shadow-2xs hover:border-slate-300"
                >
                  {/* Collapsible Chapter Header */}
                  <button
                    type="button"
                    onClick={() => toggleSection(sec.sectionId)}
                    className="w-full text-left p-3.5 sm:p-4 flex items-center justify-between gap-3 hover:bg-slate-50/80 transition-colors cursor-pointer"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[11px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md uppercase tracking-wider">
                          {sec.title.includes(':')
                            ? sec.title.split(':')[0].toUpperCase()
                            : sec.sectionId.replace('-', ' ').toUpperCase()}
                        </span>
                        <span className="text-xs font-semibold text-slate-500">
                          {sec.completedCount} / {sec.totalCount} выполнено
                        </span>
                        {hasProgress && (
                          <span className="hidden sm:inline text-xs font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md">
                            Ср. балл: {sec.avgScore}%
                          </span>
                        )}
                      </div>

                      <h3 className="text-sm sm:text-base font-bold text-slate-900 truncate">
                        {sec.title}
                      </h3>
                    </div>

                    <div className="flex items-center gap-2.5 shrink-0">
                      <span
                        className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                          is100Percent
                            ? 'bg-emerald-100 text-emerald-800'
                            : hasProgress
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-slate-100 text-slate-500'
                        }`}
                      >
                        {sec.percent}%
                      </span>
                      <ChevronDown
                        className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${
                          isExpanded ? 'rotate-180 text-blue-600' : ''
                        }`}
                      />
                    </div>
                  </button>

                  {/* Chapter Progress Bar */}
                  <div className="w-full h-1 bg-slate-100">
                    <div
                      className={`h-full transition-all duration-300 ${
                        is100Percent ? 'bg-emerald-500' : 'bg-blue-600'
                      }`}
                      style={{ width: `${sec.percent}%` }}
                    />
                  </div>

                  {/* Expanded Lessons List */}
                  {isExpanded && (
                    <div className="p-2 sm:p-3 bg-slate-50/50 border-t border-slate-100 divide-y divide-slate-100">
                      {sec.completedList.length === 0 ? (
                        <p className="text-xs text-slate-400 italic py-3 text-center">
                          В этой главе пока нет завершённых заданий.
                        </p>
                      ) : (
                        sec.completedList.map(item => {
                          const p = item.progress;
                          const act = item.activity;
                          const isHigh = p.score >= 80;

                          return (
                            <div
                              key={act.id}
                              onClick={() => onSelectActivityById(act.id)}
                              className="py-2.5 px-3 flex items-center justify-between gap-3 hover:bg-white rounded-lg cursor-pointer transition-colors group shadow-2xs my-1"
                            >
                              <div className="min-w-0">
                                <span className="text-[11px] text-slate-400 font-mono block">
                                  #{act.id} {p.lastAttemptAt ? `• ${new Date(p.lastAttemptAt).toLocaleDateString()}` : ''}
                                </span>
                                <span className="text-xs sm:text-sm font-medium text-slate-800 block truncate group-hover:text-blue-600 transition-colors">
                                  {act.title || `Lecția #${act.id}`}
                                </span>
                              </div>

                              <div className="shrink-0 flex items-center gap-2.5">
                                <span
                                  className={`text-xs font-bold px-2 py-0.5 rounded-md ${
                                    isHigh
                                      ? 'bg-emerald-100 text-emerald-800'
                                      : 'bg-amber-100 text-amber-800'
                                  }`}
                                >
                                  {p.score}%
                                </span>
                                <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-blue-600 group-hover:translate-x-0.5 transition-all" />
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
