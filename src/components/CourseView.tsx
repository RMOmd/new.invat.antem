import React, { useState, useEffect } from 'react';
import { CourseData, Section, Activity } from '../types/course';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import {
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  PlayCircle,
  BookOpen,
  Search,
  Sparkles,
  Headphones,
  FileEdit,
  HelpCircle,
  Puzzle,
  ArrowRightLeft,
  Lock
} from 'lucide-react';

interface CourseViewProps {
  courseData: CourseData;
  onSelectActivity: (activity: Activity) => void;
  selectedActivityId?: string;
  focusedActivityId?: string | null;
}

export const CourseView: React.FC<CourseViewProps> = ({
  courseData,
  onSelectActivity,
  selectedActivityId,
  focusedActivityId
}) => {
  const { allProgress, currentUser, logout } = useAuth();
  const { t } = useLanguage();
  const isDemo = currentUser?.role === 'demo';
  const [showDemoModal, setShowDemoModal] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>(() => {
    try {
      const saved = localStorage.getItem('romanian_expanded_sections');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (focusedActivityId) {
          const sec = courseData.sections.find(s => s.activities.some(a => a.id === focusedActivityId));
          if (sec) {
            parsed[sec.sectionId] = true;
          }
        }
        return parsed;
      }
    } catch (e) {
      console.error('Failed to load expanded sections from localStorage', e);
    }

    const initial: Record<string, boolean> = {
      [courseData.sections[0]?.sectionId || 'unit-0']: true,
      [courseData.sections[1]?.sectionId || 'unit-1']: true
    };
    if (focusedActivityId) {
      const sec = courseData.sections.find(s => s.activities.some(a => a.id === focusedActivityId));
      if (sec) {
        initial[sec.sectionId] = true;
      }
    }
    return initial;
  });
  const [searchQuery, setSearchQuery] = useState('');

  // Persist expanded sections in localStorage on every change
  useEffect(() => {
    try {
      localStorage.setItem('romanian_expanded_sections', JSON.stringify(expandedSections));
    } catch (e) {
      console.error('Failed to save expanded sections to localStorage', e);
    }
  }, [expandedSections]);

  // When focusedActivityId changes or on mount: auto-expand section and smoothly scroll focused activity into center view
  useEffect(() => {
    if (!focusedActivityId) return;

    const sec = courseData.sections.find(s => s.activities.some(a => a.id === focusedActivityId));
    if (sec && !expandedSections[sec.sectionId]) {
      setExpandedSections(prev => ({
        ...prev,
        [sec.sectionId]: true
      }));
    }

    const timer = setTimeout(() => {
      const el = document.getElementById(`activity-item-${focusedActivityId}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.classList.add('ring-4', 'ring-blue-500/40', 'bg-blue-50/90', 'scale-[1.01]');
        const pulseTimer = setTimeout(() => {
          el.classList.remove('ring-4', 'ring-blue-500/40', 'bg-blue-50/90', 'scale-[1.01]');
        }, 2200);
        return () => clearTimeout(pulseTimer);
      }
    }, 150);

    return () => clearTimeout(timer);
  }, [focusedActivityId]);

  const toggleSection = (secId: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [secId]: !prev[secId]
    }));
  };

  const calculateSectionStats = (section: Section) => {
    const total = section.activities.length;
    if (total === 0) return { completed: 0, percent: 0, total: 0 };
    const completed = section.activities.filter(a => allProgress[a.id]?.completed).length;
    const percent = Math.round((completed / total) * 100);
    return { completed, percent, total };
  };

  // Filter sections and activities by search query
  const filteredSections = courseData.sections.map(sec => {
    if (!searchQuery.trim()) return sec;
    const matches = sec.activities.filter(a =>
      a.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      sec.title.toLowerCase().includes(searchQuery.toLowerCase())
    );
    return {
      ...sec,
      activities: matches
    };
  }).filter(sec => sec.activities.length > 0);

  return (
    <div className="max-w-4xl mx-auto px-3 sm:px-4 py-4 pb-28">
      {/* Course Banner */}
      <div className="bg-gradient-to-br from-blue-700 via-blue-800 to-indigo-900 text-white rounded-3xl p-5 sm:p-8 mb-6 shadow-md relative overflow-hidden">
        <div className="absolute right-0 bottom-0 opacity-10 translate-x-8 translate-y-8 select-none pointer-events-none">
          <span className="text-9xl">🇲🇩</span>
        </div>
        <div className="relative z-10">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-white/20 backdrop-blur-md rounded-full text-xs font-semibold mb-3">
            <Sparkles className="w-3.5 h-3.5 text-amber-300" />
            Nivelul A1+ • ANTEM Moldova
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight mb-2">
            {t('course_banner_title')}
          </h1>
          <p className="text-blue-100 text-sm sm:text-base max-w-xl">
            {t('course_banner_desc')}
          </p>
        </div>
      </div>

      {/* Search Bar */}
      <div className="relative mb-6">
        <Search className="w-5 h-5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder={t('course_search_ph')}
          className="w-full pl-11 pr-4 py-3 bg-white border border-slate-200 rounded-2xl text-base focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-2xs"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600 bg-slate-100 px-2 py-1 rounded-md cursor-pointer"
          >
            {t('course_search_clear')}
          </button>
        )}
      </div>

      {/* Sections List */}
      <div className="space-y-4">
        {filteredSections.map((sec, secIdx) => {
          const stats = calculateSectionStats(sec);
          const isLockedForDemo = isDemo && secIdx > 1;
          const isExpanded = !isLockedForDemo && (expandedSections[sec.sectionId] || !!searchQuery.trim());

          return (
            <div
              key={sec.sectionId}
              className={`border rounded-2xl overflow-hidden shadow-2xs transition-all ${
                isLockedForDemo ? 'bg-slate-50/70 border-slate-200/90' : 'bg-white border-slate-200'
              }`}
            >
              {/* Section Header Accordion */}
              <button
                type="button"
                onClick={() => {
                  if (isLockedForDemo) {
                    setShowDemoModal(true);
                    return;
                  }
                  toggleSection(sec.sectionId);
                }}
                className={`w-full text-left p-4 sm:p-5 flex items-center justify-between gap-3 transition-colors cursor-pointer ${
                  isLockedForDemo ? 'hover:bg-amber-50/40' : 'hover:bg-slate-50/80'
                }`}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    {isLockedForDemo ? (
                      <span className="text-[10px] font-bold text-amber-800 bg-amber-100/90 px-2 py-0.5 rounded-md flex items-center gap-1">
                        <Lock className="w-3 h-3 text-amber-700" />
                        {t('demo_locked_badge')}
                      </span>
                    ) : (
                      <span className="text-xs font-bold text-blue-700 bg-blue-50 px-2.5 py-0.5 rounded-md">
                        {sec.sectionId === 'test-final' || sec.title.includes('Test Final')
                          ? 'TEST FINAL'
                          : sec.title.includes(':')
                          ? sec.title.split(':')[0].toUpperCase()
                          : sec.sectionId.replace('-', ' ').toUpperCase()}
                      </span>
                    )}
                    <span className="text-xs text-slate-500">
                      {isLockedForDemo ? t('course_units_count', { count: 20 }) : t('course_completed_stat', { completed: stats.completed, total: stats.total })}
                    </span>
                  </div>
                  <h2 className={`text-base sm:text-lg font-bold truncate ${
                    isLockedForDemo ? 'text-slate-600' : 'text-slate-900'
                  }`}>
                    {sec.title}
                  </h2>

                  {/* Unit Progress Bar */}
                  {!isLockedForDemo && (
                    <div className="w-full bg-slate-100 rounded-full h-1.5 mt-2 overflow-hidden max-w-xs">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          stats.percent === 100 ? 'bg-emerald-500' : 'bg-blue-600'
                        }`}
                        style={{ width: `${stats.percent}%` }}
                      />
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {isLockedForDemo ? (
                    <div className="p-2 bg-amber-100 text-amber-700 rounded-xl">
                      <Lock className="w-4 h-4" />
                    </div>
                  ) : (
                    <>
                      <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                        stats.percent === 100
                          ? 'bg-emerald-100 text-emerald-800'
                          : stats.percent > 0
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-slate-100 text-slate-600'
                      }`}>
                        {stats.percent}%
                      </span>
                      {isExpanded ? (
                        <ChevronDown className="w-5 h-5 text-slate-400" />
                      ) : (
                        <ChevronRight className="w-5 h-5 text-slate-400" />
                      )}
                    </>
                  )}
                </div>
              </button>

              {/* Activities list inside Section */}
              {isExpanded && (
                <div className="border-t border-slate-100 bg-slate-50/50 p-2 sm:p-3 space-y-1.5">
                  {sec.activities.map((act, aIdx) => {
                    const actProgress = allProgress[act.id];
                    const isCompleted = actProgress?.completed;
                    const isSelected = selectedActivityId === act.id;
                    const gapsCount = act.gaps?.length || 0;

                    const isPlaylist = act.type === 'audio_playlist' || (act.audioTracks && act.audioTracks.length > 0);
                    const isAssignment = act.type === 'assignment';
                    const isMatching = act.type === 'matching' || (act.matchingPairs && act.matchingPairs.length > 0);
                    const matchingCount = act.matchingPairs?.length || 0;
                    const quizCount = act.quizQuestions?.length || 0;
                    const orderCount = act.orderItems?.length || 0;
                    const trackCount = act.audioTracks?.length || 0;

                    let typeLabel = t('course_type_reading');
                    let typeIcon = <BookOpen className="w-5 h-5 text-slate-400" />;

                    if (isPlaylist) {
                      typeLabel = `🎧 ${t('course_type_audio')} • ${trackCount}`;
                      typeIcon = <Headphones className="w-5 h-5 text-indigo-600" />;
                    } else if (isAssignment) {
                      typeLabel = `✍️ ${t('course_type_assignment')}`;
                      typeIcon = <FileEdit className="w-5 h-5 text-amber-600" />;
                    } else if (isMatching) {
                      typeLabel = `🔗 ${t('course_type_matching')} • ${matchingCount}`;
                      typeIcon = <ArrowRightLeft className="w-5 h-5 text-teal-600" />;
                    } else if (quizCount > 0) {
                      typeLabel = `📝 ${t('course_type_quiz')} • ${quizCount}`;
                      typeIcon = <HelpCircle className="w-5 h-5 text-purple-600" />;
                    } else if (orderCount > 0) {
                      typeLabel = `🧩 ${t('course_type_dialogue')} • ${orderCount}`;
                      typeIcon = <Puzzle className="w-5 h-5 text-blue-600" />;
                    } else if (gapsCount > 0) {
                      typeLabel = `✏️ ${t('course_type_gap')} • ${gapsCount}`;
                      typeIcon = <PlayCircle className="w-5 h-5 text-blue-600" />;
                    }

                    const isFocused = focusedActivityId === act.id;

                    return (
                      <button
                        key={act.id}
                        id={`activity-item-${act.id}`}
                        type="button"
                        onClick={() => onSelectActivity(act)}
                        className={`w-full text-left p-3 rounded-xl border flex items-center justify-between gap-3 transition-all scroll-mt-24 sm:scroll-mt-32 ${
                          isSelected || isFocused
                            ? 'bg-blue-50/90 border-blue-400 ring-2 ring-blue-400/30 shadow-xs'
                            : isCompleted
                            ? 'bg-white border-slate-200/80 hover:border-slate-300'
                            : isPlaylist
                            ? 'bg-indigo-50/40 border-indigo-200 hover:border-indigo-300 hover:shadow-2xs'
                            : isAssignment
                            ? 'bg-amber-50/30 border-amber-200 hover:border-amber-300 hover:shadow-2xs'
                            : 'bg-white border-slate-200 hover:border-blue-300 hover:shadow-2xs'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="shrink-0">
                            {isCompleted ? (
                              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                            ) : (
                              typeIcon
                            )}
                          </div>
                          <div className="min-w-0">
                            <span className="text-xs text-slate-400 font-mono block">
                              #{act.id} • {typeLabel}
                            </span>
                            <span className="text-sm font-semibold text-slate-800 block truncate">
                              {act.title}
                            </span>
                          </div>
                        </div>

                        {actProgress && (
                          <div className="shrink-0 text-right">
                            <span className={`text-xs font-bold px-2 py-0.5 rounded-md ${
                              actProgress.score >= 80 ? 'text-emerald-700 bg-emerald-50' : 'text-amber-700 bg-amber-50'
                            }`}>
                              {actProgress.score}%
                            </span>
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
      {/* DEMO RESTRICTED MODAL */}
      {showDemoModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
            <div className="w-12 h-12 bg-amber-100 rounded-2xl flex items-center justify-center mb-4 text-amber-600">
              <Lock className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 mb-2">
              {t('demo_locked_alert_title')}
            </h3>
            <p className="text-sm text-slate-600 mb-6 leading-relaxed">
              {t('demo_locked_alert_desc')}
            </p>
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => {
                  logout();
                }}
                className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs transition-all shadow-md shadow-blue-500/25 cursor-pointer"
              >
                {t('demo_locked_btn_register')}
              </button>
              <button
                type="button"
                onClick={() => setShowDemoModal(false)}
                className="w-full py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition-all cursor-pointer"
              >
                {t('btn_close')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

