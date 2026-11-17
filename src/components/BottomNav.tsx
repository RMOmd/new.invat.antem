import React from 'react';
import { useLanguage } from '../context/LanguageContext';
import { BookOpen, BarChart3, Send, User, Sparkles } from 'lucide-react';

export type TabType = 'course' | 'stats' | 'submissions' | 'profile' | 'ai_chat';

interface BottomNavProps {
  currentTab: TabType;
  onTabChange: (tab: TabType) => void;
  pendingSubmissionsCount?: number;
  badgeColor?: 'rose' | 'emerald';
  isTeacherOrAdmin?: boolean;
}

export const BottomNav: React.FC<BottomNavProps> = ({
  currentTab,
  onTabChange,
  pendingSubmissionsCount = 0,
  badgeColor = 'rose',
  isTeacherOrAdmin = false
}) => {
  const { t } = useLanguage();

  const tabs = [
    { id: 'course' as TabType, label: t('tab_course'), icon: BookOpen },
    { id: 'stats' as TabType, label: t('tab_stats'), icon: BarChart3 },
    { id: 'submissions' as TabType, label: t('tab_submissions'), icon: Send, badge: pendingSubmissionsCount },
    ...(isTeacherOrAdmin
      ? [{ id: 'ai_chat' as TabType, label: t('tab_ai_chat'), icon: Sparkles }]
      : []),
    { id: 'profile' as TabType, label: t('tab_profile'), icon: User },
  ];

  const colClass = tabs.length === 5 ? 'grid-cols-5' : 'grid-cols-4';

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-slate-200 z-30 sm:hidden">
      <div className={`grid ${colClass} h-16`}>
        {tabs.map(tab => {
          const Icon = tab.icon;
          const isActive = currentTab === tab.id;

          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`flex flex-col items-center justify-center gap-1 transition-colors relative ${
                isActive ? 'text-blue-600 font-bold' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <div className="relative">
                <Icon className={`w-5 h-5 ${isActive ? 'stroke-[2.5px]' : 'stroke-2'}`} />
                {tab.badge && tab.badge > 0 ? (
                  <span className={`absolute -top-1.5 -right-2 text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center ${
                    badgeColor === 'emerald' ? 'bg-emerald-500' : 'bg-rose-500'
                  }`}>
                    {tab.badge}
                  </span>
                ) : null}
              </div>
              <span className="text-[11px] leading-none tracking-tight">{tab.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};

