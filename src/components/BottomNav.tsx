import React from 'react';
import { BookOpen, BarChart3, Send, User } from 'lucide-react';

export type TabType = 'course' | 'stats' | 'submissions' | 'profile';

interface BottomNavProps {
  currentTab: TabType;
  onTabChange: (tab: TabType) => void;
  pendingSubmissionsCount?: number;
}

export const BottomNav: React.FC<BottomNavProps> = ({
  currentTab,
  onTabChange,
  pendingSubmissionsCount = 0
}) => {
  const tabs = [
    { id: 'course' as TabType, label: 'Curs', icon: BookOpen },
    { id: 'stats' as TabType, label: 'Statistici', icon: BarChart3 },
    { id: 'submissions' as TabType, label: 'Teme', icon: Send, badge: pendingSubmissionsCount },
    { id: 'profile' as TabType, label: 'Profil', icon: User },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-slate-200 z-30 sm:hidden">
      <div className="grid grid-cols-4 h-16">
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
                  <span className="absolute -top-1.5 -right-2 bg-rose-500 text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
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

