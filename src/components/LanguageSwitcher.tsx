import React from 'react';
import { useLanguage, Language } from '../context/LanguageContext';

interface LanguageSwitcherProps {
  className?: string;
}

export const LanguageSwitcher: React.FC<LanguageSwitcherProps> = ({ className = '' }) => {
  const { language, setLanguage } = useLanguage();

  const options: { code: Language; label: string }[] = [
    { code: 'ro', label: 'RO' },
    { code: 'ru', label: 'RU' },
    { code: 'en', label: 'EN' }
  ];

  return (
    <div className={`inline-flex items-center p-0.5 bg-slate-100 rounded-xl border border-slate-200/80 shadow-2xs ${className}`}>
      {options.map(opt => {
        const isActive = language === opt.code;
        return (
          <button
            key={opt.code}
            type="button"
            onClick={() => setLanguage(opt.code)}
            className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
              isActive
                ? 'bg-white text-blue-600 shadow-2xs'
                : 'text-slate-500 hover:text-slate-800'
            }`}
            title={`Limba / Язык / Language: ${opt.label}`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
};
