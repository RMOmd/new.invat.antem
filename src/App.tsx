import React, { useState, useEffect } from 'react';
import { CourseData, Activity, Section } from './types/course';
import { AuthProvider, useAuth } from './context/AuthContext';
import { LanguageProvider, useLanguage } from './context/LanguageContext';
import { Navbar } from './components/Navbar';
import { BottomNav, TabType } from './components/BottomNav';
import { CourseView } from './components/CourseView';
import { ExerciseRunner } from './components/ExerciseRunner';
import { StatsView } from './components/StatsView';
import { SubmissionsView } from './components/SubmissionsView';
import { AuthView } from './components/AuthView';
import { Loader2, ArrowLeft, BookOpen, BarChart3, Send } from 'lucide-react';

const AppContent: React.FC = () => {
  const { t } = useLanguage();
  const [courseData, setCourseData] = useState<CourseData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [currentTab, setCurrentTab] = useState<TabType>('course');
  const [selectedActivity, setSelectedActivity] = useState<Activity | null>(null);
  const [lastActiveActivityId, setLastActiveActivityId] = useState<string | null>(() => {
    try {
      return localStorage.getItem('romanian_last_active_activity');
    } catch {
      return null;
    }
  });

  const { currentUser, allProgress, saveProgress, submitAssignment, allSubmissions } = useAuth();

  // Load course data from JSON
  useEffect(() => {
    fetch('./course_data.json')
      .then(res => {
        if (!res.ok) throw new Error(`HTTP error ${res.status}`);
        return res.json();
      })
      .then(data => {
        setCourseData(data);
        setLoading(false);
      })
      .catch(err => {
        console.error('Failed to load course data:', err);
        setError('Eroare la încărcarea datelor cursului. Verificați conexiunea.');
        setLoading(false);
      });
  }, []);

  // If not logged in, gate access completely and display AuthView
  if (!currentUser) {
    return <AuthView />;
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <Loader2 className="w-10 h-10 text-blue-600 animate-spin mb-3" />
        <p className="text-slate-600 font-semibold text-sm">Se încarcă cursul de limbă română...</p>
      </div>
    );
  }

  if (error || !courseData) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4 text-center">
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl max-w-md text-rose-800 text-sm">
          {error || 'Cursul nu a putut fi încărcat.'}
        </div>
      </div>
    );
  }

  // Flatten activities to enable Previous / Next navigation
  const flatActivities = courseData.sections.flatMap(s => s.activities);
  const currentIdx = selectedActivity ? flatActivities.findIndex(a => a.id === selectedActivity.id) : -1;
  const hasPrev = currentIdx > 0;
  const hasNext = currentIdx >= 0 && currentIdx < flatActivities.length - 1;

  const handleSelectActivity = (act: Activity) => {
    if (currentUser?.role === 'demo') {
      const secIdx = courseData.sections.findIndex(s => s.activities.some(a => a.id === act.id));
      if (secIdx > 1) {
        alert(t('demo_locked_alert_desc'));
        return;
      }
    }
    setSelectedActivity(act);
    setLastActiveActivityId(act.id);
    try {
      localStorage.setItem('romanian_last_active_activity', act.id);
    } catch {}
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handlePrev = () => {
    if (hasPrev) {
      const prevAct = flatActivities[currentIdx - 1];
      setSelectedActivity(prevAct);
      setLastActiveActivityId(prevAct.id);
      try {
        localStorage.setItem('romanian_last_active_activity', prevAct.id);
      } catch {}
      window.scrollTo({ top: 0, behavior: 'instant' });
    }
  };

  const handleNext = () => {
    if (hasNext) {
      const nextAct = flatActivities[currentIdx + 1];
      if (currentUser?.role === 'demo') {
        const secIdx = courseData.sections.findIndex(s => s.activities.some(a => a.id === nextAct.id));
        if (secIdx > 1) {
          alert(t('demo_locked_alert_desc'));
          return;
        }
      }
      setSelectedActivity(nextAct);
      setLastActiveActivityId(nextAct.id);
      try {
        localStorage.setItem('romanian_last_active_activity', nextAct.id);
      } catch {}
      window.scrollTo({ top: 0, behavior: 'instant' });
    }
  };

  const handleSelectActivityById = (actId: string) => {
    const found = flatActivities.find(a => a.id === actId);
    if (found) {
      handleSelectActivity(found);
      setCurrentTab('course');
    }
  };

  const pendingSubmissionsCount = (currentUser?.role === 'teacher' || currentUser?.role === 'admin')
    ? allSubmissions.filter(s => s.status === 'pending').length
    : 0;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col text-slate-900 font-sans">
      <Navbar
        isInsideExercise={!!selectedActivity}
        onBackToCourse={() => setSelectedActivity(null)}
      />

      {/* Desktop Header Tab Navigation */}
      <div className="hidden sm:block bg-white border-b border-slate-200 sticky top-14 sm:top-16 z-20">
        <div className="max-w-4xl mx-auto px-4 flex gap-4 h-12">
          <button
            onClick={() => {
              setCurrentTab('course');
              setSelectedActivity(null);
            }}
            className={`flex items-center gap-2 px-3 border-b-2 text-sm font-semibold transition-colors ${
              currentTab === 'course' && !selectedActivity
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <BookOpen className="w-4 h-4" />
            {t('nav_course')} ({t('course_units_count', { count: courseData.totalSections })})
          </button>

          <button
            onClick={() => {
              setCurrentTab('stats');
              setSelectedActivity(null);
            }}
            className={`flex items-center gap-2 px-3 border-b-2 text-sm font-semibold transition-colors ${
              currentTab === 'stats'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            {t('nav_stats')}
          </button>

          <button
            onClick={() => {
              setCurrentTab('submissions');
              setSelectedActivity(null);
            }}
            className={`flex items-center gap-2 px-3 border-b-2 text-sm font-semibold transition-colors relative ${
              currentTab === 'submissions'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Send className="w-4 h-4" />
            {t('nav_submissions')}
            {pendingSubmissionsCount > 0 && (
              <span className="bg-rose-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                {pendingSubmissionsCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <main className="flex-1">
        {selectedActivity ? (
          <div>
            {/* Breadcrumb / Back button */}
            <div className="max-w-3xl mx-auto px-4 pt-3 pb-1">
              <button
                type="button"
                onClick={() => setSelectedActivity(null)}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-blue-600 transition-colors bg-white px-3 py-1.5 rounded-xl border border-slate-200 shadow-2xs cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                {t('btn_back_to_units')}
              </button>
            </div>

            <ExerciseRunner
              activity={selectedActivity}
              savedProgress={allProgress[selectedActivity.id]}
              onSaveProgress={saveProgress}
              onSubmitAssignment={submitAssignment}
              onPrev={handlePrev}
              onNext={handleNext}
              hasPrev={hasPrev}
              hasNext={hasNext}
            />
          </div>
        ) : (
          <>
            {currentTab === 'course' && (
              <CourseView
                courseData={courseData}
                onSelectActivity={handleSelectActivity}
                focusedActivityId={lastActiveActivityId}
              />
            )}

            {currentTab === 'stats' && (
              <StatsView
                courseData={courseData}
                onSelectActivityById={handleSelectActivityById}
              />
            )}

            {currentTab === 'submissions' && <SubmissionsView />}

            {currentTab === 'profile' && (
              <StatsView
                courseData={courseData}
                onSelectActivityById={handleSelectActivityById}
              />
            )}
          </>
        )}
      </main>

      {/* Mobile Bottom Navigation (Only visible when not deep in an exercise test runner) */}
      {!selectedActivity && (
        <BottomNav
          currentTab={currentTab}
          onTabChange={tab => {
            setCurrentTab(tab);
            setSelectedActivity(null);
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          pendingSubmissionsCount={pendingSubmissionsCount}
        />
      )}
    </div>
  );
};

export default function App() {
  return (
    <LanguageProvider>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </LanguageProvider>
  );
}

