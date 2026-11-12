import React, { useState, useEffect } from 'react';
import { CourseData, Section, Activity } from '../types/course';
import { useAuth } from '../context/AuthContext';
import { ChevronDown, ChevronRight, CheckCircle2, PlayCircle, BookOpen, Search, Sparkles, Headphones, FileEdit, HelpCircle, Puzzle, ArrowRightLeft } from 'lucide-react';

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
  const { allProgress } = useAuth();
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
    if (total === 0) return { completed: 0, percent: 0 };
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
            Limba Română pentru începători
          </h1>
          <p className="text-blue-100 text-sm sm:text-base max-w-xl">
            20 de unități tematice, dialoguri autentice, gramatică practică și peste 400 de exerciții interactive.
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
          placeholder="Căutați lecții, vocabular, dialoguri sau gramatică..."
          className="w-full pl-11 pr-4 py-3 bg-white border border-slate-200 rounded-2xl text-base focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-2xs"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600 bg-slate-100 px-2 py-1 rounded-md"
          >
            Șterge
          </button>
        )}
      </div>

      {/* Sections List */}
      <div className="space-y-4">
        {filteredSections.map(sec => {
          const stats = calculateSectionStats(sec);
          const isExpanded = expandedSections[sec.sectionId] || !!searchQuery.trim();

          return (
            <div
              key={sec.sectionId}
              className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-2xs transition-all"
            >
              {/* Section Header Accordion */}
              <button
                type="button"
                onClick={() => toggleSection(sec.sectionId)}
                className="w-full text-left p-4 sm:p-5 flex items-center justify-between gap-3 hover:bg-slate-50/80 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-bold text-blue-700 bg-blue-50 px-2.5 py-0.5 rounded-md">
                      {sec.sectionId === 'test-final' || sec.title.includes('Test Final')
                        ? 'TEST FINAL'
                        : sec.title.includes(':')
                        ? sec.title.split(':')[0].toUpperCase()
                        : sec.sectionId.replace('-', ' ').toUpperCase()}
                    </span>
                    <span className="text-xs text-slate-500">
                      {stats.completed}/{stats.total} finalizate
                    </span>
                  </div>
                  <h2 className="text-base sm:text-lg font-bold text-slate-900 truncate">
                    {sec.title}
                  </h2>

                  {/* Unit Progress Bar */}
                  <div className="w-full bg-slate-100 rounded-full h-1.5 mt-2 overflow-hidden max-w-xs">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        stats.percent === 100 ? 'bg-emerald-500' : 'bg-blue-600'
                      }`}
                      style={{ width: `${stats.percent}%` }}
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
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

                    let typeLabel = 'Lectură / Audio';
                    let typeIcon = <BookOpen className="w-5 h-5 text-slate-400" />;

                    if (isPlaylist) {
                      typeLabel = `🎧 Audio suplimentar • ${trackCount} înregistrări`;
                      typeIcon = <Headphones className="w-5 h-5 text-indigo-600" />;
                    } else if (isAssignment) {
                      typeLabel = '✍️ Temă scrisă pentru profesor';
                      typeIcon = <FileEdit className="w-5 h-5 text-amber-600" />;
                    } else if (isMatching) {
                      typeLabel = `🔗 Corelare • ${matchingCount} perechi`;
                      typeIcon = <ArrowRightLeft className="w-5 h-5 text-teal-600" />;
                    } else if (quizCount > 0) {
                      typeLabel = `📝 Test • ${quizCount} întrebări`;
                      typeIcon = <HelpCircle className="w-5 h-5 text-purple-600" />;
                    } else if (orderCount > 0) {
                      typeLabel = `🧩 Ordonare • ${orderCount} replici`;
                      typeIcon = <Puzzle className="w-5 h-5 text-blue-600" />;
                    } else if (gapsCount > 0) {
                      typeLabel = `✏️ Exercițiu • ${gapsCount} spații`;
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
    </div>
  );
};

