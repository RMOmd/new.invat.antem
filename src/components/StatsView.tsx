import React from 'react';
import { CourseData } from '../types/course';
import { useAuth } from '../context/AuthContext';
import { Trophy, CheckCircle, Target, Clock, ArrowRight } from 'lucide-react';

interface StatsViewProps {
  courseData: CourseData;
  onSelectActivityById: (id: string) => void;
}

export const StatsView: React.FC<StatsViewProps> = ({ courseData, onSelectActivityById }) => {
  const { currentUser, allProgress } = useAuth();

  // Calculate aggregate stats
  const allActivities = courseData.sections.flatMap(s => s.activities);
  const totalActivities = allActivities.length;

  const completedActivities = Object.values(allProgress).filter(p => p.completed);
  const completedCount = completedActivities.length;
  const overallPercent = Math.round((completedCount / totalActivities) * 100);

  const averageScore = completedActivities.length > 0
    ? Math.round(completedActivities.reduce((acc, p) => acc + (p.score || 0), 0) / completedActivities.length)
    : 0;

  const totalGapsCompleted = completedActivities.reduce((acc, p) => acc + (p.correctCount || 0), 0);

  // Weak activities (score < 80%) for error review
  const needsReview = completedActivities.filter(p => p.score < 80);

  return (
    <div className="max-w-4xl mx-auto px-3 sm:px-4 py-4 pb-28">
      {/* Header */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 mb-6 shadow-xs">
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900 mb-1">
          Statistica progresului • {currentUser?.name || 'Student'}
        </h1>
        <p className="text-sm text-slate-500">
          Urmăriți-vă rezultatele învățării limbii române și lucrați asupra greșelilor.
        </p>

        {/* 4 Key KPI Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5">
          <div className="p-3.5 bg-blue-50/70 border border-blue-200 rounded-xl">
            <div className="flex items-center gap-1.5 text-blue-700 text-xs font-semibold mb-1">
              <CheckCircle className="w-4 h-4" /> Finalizate
            </div>
            <div className="text-2xl font-extrabold text-blue-900">
              {completedCount} <span className="text-xs font-normal text-slate-500">/ {totalActivities}</span>
            </div>
            <div className="text-[11px] text-blue-600 mt-0.5">{overallPercent}% din curs</div>
          </div>

          <div className="p-3.5 bg-emerald-50/70 border border-emerald-200 rounded-xl">
            <div className="flex items-center gap-1.5 text-emerald-700 text-xs font-semibold mb-1">
              <Trophy className="w-4 h-4" /> Scor mediu
            </div>
            <div className="text-2xl font-extrabold text-emerald-900">
              {averageScore}%
            </div>
            <div className="text-[11px] text-emerald-600 mt-0.5">precizie răspunsuri</div>
          </div>

          <div className="p-3.5 bg-indigo-50/70 border border-indigo-200 rounded-xl">
            <div className="flex items-center gap-1.5 text-indigo-700 text-xs font-semibold mb-1">
              <Target className="w-4 h-4" /> Răspunsuri corecte
            </div>
            <div className="text-2xl font-extrabold text-indigo-900">
              {totalGapsCompleted}
            </div>
            <div className="text-[11px] text-indigo-600 mt-0.5">spații completate</div>
          </div>

          <div className="p-3.5 bg-purple-50/70 border border-purple-200 rounded-xl">
            <div className="flex items-center gap-1.5 text-purple-700 text-xs font-semibold mb-1">
              <Clock className="w-4 h-4" /> Nivel curent
            </div>
            <div className="text-2xl font-extrabold text-purple-900">
              A1+
            </div>
            <div className="text-[11px] text-purple-600 mt-0.5">Elementar superior</div>
          </div>
        </div>
      </div>

      {/* Review mistakes / Need practice */}
      {needsReview.length > 0 && (
        <div className="bg-amber-50/70 border border-amber-200 rounded-2xl p-5 mb-6 shadow-xs">
          <h2 className="text-base font-bold text-amber-900 mb-2 flex items-center gap-2">
            <span>⚠️</span> Lecții recomandate pentru repetare ({needsReview.length})
          </h2>
          <p className="text-xs text-amber-700 mb-3">
            În aceste exerciții ați obținut mai puțin de 80%. Re-încercați-le pentru a vă îmbunătăți scorul:
          </p>
          <div className="space-y-2">
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
                      className="text-xs font-bold px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg flex items-center gap-1 transition-colors"
                    >
                      Repetă <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* History of completed activities */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
        <h2 className="text-base font-bold text-slate-900 mb-4">
          Istoric activități finalizate ({completedActivities.length})
        </h2>

        {completedActivities.length === 0 ? (
          <p className="text-sm text-slate-500 italic py-6 text-center">
            Nu ați finalizat încă nicio lecție. Începeți prima unitate din pagina principală!
          </p>
        ) : (
          <div className="divide-y divide-slate-100 max-h-96 overflow-y-auto">
            {completedActivities.map(p => {
              const act = allActivities.find(a => a.id === p.activityId);
              return (
                <div
                  key={p.activityId}
                  onClick={() => onSelectActivityById(p.activityId)}
                  className="py-3 px-2 flex items-center justify-between gap-3 hover:bg-slate-50 rounded-lg cursor-pointer transition-colors"
                >
                  <div className="min-w-0">
                    <span className="text-xs text-slate-400 font-mono block">
                      #{p.activityId} • {p.lastAttemptAt ? new Date(p.lastAttemptAt).toLocaleDateString() : ''}
                    </span>
                    <span className="text-sm font-medium text-slate-800 block truncate">
                      {act?.title || `Lecția #${p.activityId}`}
                    </span>
                  </div>
                  <div className="shrink-0 flex items-center gap-2">
                    <span className={`text-xs font-bold px-2.5 py-1 rounded-md ${
                      p.score >= 80 ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                    }`}>
                      {p.score}%
                    </span>
                    <ArrowRight className="w-4 h-4 text-slate-400" />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

