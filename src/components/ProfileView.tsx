import React from 'react';
import { useAuth } from '../context/AuthContext';
import { useLanguage, Language } from '../context/LanguageContext';
import { CourseData } from '../types/course';
import {
  User,
  LogOut,
  Shield,
  Award,
  GraduationCap,
  Sparkles,
  RefreshCw,
  Globe,
  Database,
  Calendar,
  CheckCircle2,
  Clock,
  Key,
  Lock,
  AlertCircle
} from 'lucide-react';

interface ProfileViewProps {
  courseData: CourseData;
}

export const ProfileView: React.FC<ProfileViewProps> = ({ courseData }) => {
  const {
    currentUser,
    logout,
    syncAllFromDatabase,
    isSyncing,
    lastSyncedAt,
    allProgress,
    updateUserPassword,
    resetPasswordForEmail
  } = useAuth();
  const { language, setLanguage, t } = useLanguage();

  // Password change state
  const [showChangePass, setShowChangePass] = React.useState(false);
  const [newPasswordVal, setNewPasswordVal] = React.useState('');
  const [confirmPasswordVal, setConfirmPasswordVal] = React.useState('');
  const [passStatus, setPassStatus] = React.useState<{ ok: boolean; msg: string } | null>(null);
  const [isUpdatingPass, setIsUpdatingPass] = React.useState(false);

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPassStatus(null);
    if (newPasswordVal.length < 6) {
      setPassStatus({ ok: false, msg: t('auth_err_short_pass') });
      return;
    }
    if (newPasswordVal !== confirmPasswordVal) {
      setPassStatus({ ok: false, msg: t('auth_err_pass_mismatch') });
      return;
    }
    setIsUpdatingPass(true);
    try {
      const res = await updateUserPassword(newPasswordVal);
      if (res.success) {
        setPassStatus({ ok: true, msg: t('profile_pass_updated_success') });
        setNewPasswordVal('');
        setConfirmPasswordVal('');
        setTimeout(() => setShowChangePass(false), 2000);
      } else {
        setPassStatus({ ok: false, msg: res.error || 'Eroare la actualizarea parolei' });
      }
    } finally {
      setIsUpdatingPass(false);
    }
  };

  const handleSendRecoveryEmail = async () => {
    if (!currentUser?.email) return;
    setPassStatus(null);
    setIsUpdatingPass(true);
    try {
      const res = await resetPasswordForEmail(currentUser.email);
      if (res.success) {
        setPassStatus({ ok: true, msg: res.message || t('auth_recovery_sent_success') });
      } else {
        setPassStatus({ ok: false, msg: res.error || 'Eroare' });
      }
    } finally {
      setIsUpdatingPass(false);
    }
  };

  const allActivities = courseData.sections.flatMap(s => s.activities);
  const totalActivities = allActivities.length;
  const completedActivities = Object.values(allProgress).filter(p => p.completed);
  const completedCount = completedActivities.length;
  const overallPercent = totalActivities > 0 ? Math.round((completedCount / totalActivities) * 100) : 0;

  const languages: { code: Language; name: string; flag: string }[] = [
    { code: 'ro', name: 'Română', flag: '🇷🇴' },
    { code: 'ru', name: 'Русский', flag: '🇷🇺' },
    { code: 'en', name: 'English', flag: '🇬🇧' }
  ];

  return (
    <div className="max-w-2xl mx-auto px-3 sm:px-4 py-4 pb-28 space-y-5">
      {/* User Identity Card */}
      <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs">
        <div className="flex items-center gap-4 mb-5">
          <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-white text-xl font-black shadow-md ${
            currentUser?.role === 'admin'
              ? 'bg-gradient-to-br from-rose-500 to-rose-700'
              : currentUser?.role === 'teacher'
              ? 'bg-gradient-to-br from-purple-500 to-purple-700'
              : currentUser?.role === 'demo'
              ? 'bg-gradient-to-br from-amber-500 to-amber-700'
              : 'bg-gradient-to-br from-blue-500 to-blue-700'
          }`}>
            {currentUser?.name ? currentUser.name.charAt(0).toUpperCase() : 'U'}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-black text-slate-900 truncate">
                {currentUser?.name}
              </h1>
              <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider ${
                currentUser?.role === 'admin'
                  ? 'bg-rose-100 text-rose-700 border border-rose-200'
                  : currentUser?.role === 'teacher'
                  ? 'bg-purple-100 text-purple-700 border border-purple-200'
                  : currentUser?.role === 'demo'
                  ? 'bg-amber-100 text-amber-800 border border-amber-200'
                  : 'bg-blue-100 text-blue-700 border border-blue-200'
              }`}>
                {currentUser?.role === 'admin'
                  ? t('role_admin')
                  : currentUser?.role === 'teacher'
                  ? t('role_teacher')
                  : currentUser?.role === 'demo'
                  ? t('role_demo')
                  : t('role_student')}
              </span>
            </div>
            <p className="text-xs text-slate-500 font-mono mt-0.5 truncate">
              {currentUser?.email}
            </p>
          </div>
        </div>

        {/* Learning Quick Stats Bar */}
        <div className="grid grid-cols-2 gap-3 p-3.5 bg-slate-50 rounded-2xl border border-slate-200/80 mb-5">
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">
              Progres Curs
            </span>
            <div className="flex items-baseline gap-1.5">
              <span className="text-lg font-black text-blue-600">{overallPercent}%</span>
              <span className="text-xs text-slate-500 font-semibold">({completedCount}/{totalActivities})</span>
            </div>
          </div>
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">
              Lecții Finalizate
            </span>
            <div className="flex items-baseline gap-1.5">
              <span className="text-lg font-black text-emerald-600">{completedCount}</span>
              <span className="text-xs text-slate-500 font-semibold">lecții</span>
            </div>
          </div>
        </div>

        {/* Logout action */}
        <button
          type="button"
          onClick={logout}
          className="w-full py-2.5 px-4 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 font-bold rounded-xl text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer"
        >
          <LogOut className="w-4 h-4" />
          {t('btn_logout')}
        </button>
      </div>

      {/* Password & Security Card */}
      <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
            <Key className="w-4 h-4 text-blue-600" />
            {t('profile_security_title')}
          </h2>
          <button
            type="button"
            onClick={() => {
              setShowChangePass(!showChangePass);
              setPassStatus(null);
            }}
            className="text-xs font-bold text-blue-600 hover:text-blue-800 cursor-pointer"
          >
            {showChangePass ? t('btn_close') : t('profile_btn_change_pass')}
          </button>
        </div>

        <p className="text-xs text-slate-500 leading-relaxed">
          {t('profile_security_desc')}
        </p>

        {passStatus && (
          <div className={`p-3 rounded-2xl text-xs flex items-start gap-2.5 ${
            passStatus.ok
              ? 'bg-emerald-50 border border-emerald-200 text-emerald-900'
              : 'bg-rose-50 border border-rose-200 text-rose-900'
          }`}>
            {passStatus.ok ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            )}
            <span>{passStatus.msg}</span>
          </div>
        )}

        {showChangePass && (
          <form onSubmit={handleUpdatePassword} className="space-y-3 pt-2 border-t border-slate-100">
            <div>
              <label htmlFor="profile-new-pass" className="block text-xs font-bold text-slate-700 mb-1 cursor-pointer">
                {t('profile_new_pass_label')}
              </label>
              <input
                id="profile-new-pass"
                name="newPassword"
                type="password"
                value={newPasswordVal}
                onChange={e => setNewPasswordVal(e.target.value)}
                placeholder="••••••••"
                autoComplete="new-password"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900"
                required
              />
            </div>

            <div>
              <label htmlFor="profile-confirm-new-pass" className="block text-xs font-bold text-slate-700 mb-1 cursor-pointer">
                {t('profile_confirm_new_pass_label')}
              </label>
              <input
                id="profile-confirm-new-pass"
                name="confirmNewPassword"
                type="password"
                value={confirmPasswordVal}
                onChange={e => setConfirmPasswordVal(e.target.value)}
                placeholder="••••••••"
                autoComplete="new-password"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900"
                required
              />
            </div>

            <div className="flex flex-col sm:flex-row gap-2 pt-1">
              <button
                type="submit"
                disabled={isUpdatingPass}
                className="flex-1 py-2.5 px-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs transition-colors cursor-pointer disabled:opacity-50"
              >
                {t('profile_btn_update_pass')}
              </button>
              <button
                type="button"
                disabled={isUpdatingPass}
                onClick={handleSendRecoveryEmail}
                className="py-2.5 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition-colors cursor-pointer"
              >
                Trimite link resetare pe e-mail
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Language Preferences */}
      <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-xs">
        <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5 mb-3">
          <Globe className="w-4 h-4 text-slate-500" />
          Limba Interfeței (Interface Language)
        </h2>
        <div className="grid grid-cols-3 gap-2">
          {languages.map(lang => (
            <button
              key={lang.code}
              type="button"
              onClick={() => setLanguage(lang.code)}
              className={`py-2.5 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                language === lang.code
                  ? 'bg-blue-600 border-blue-600 text-white shadow-xs'
                  : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700'
              }`}
            >
              <span>{lang.flag}</span>
              <span>{lang.name}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Cloud Sync & Database Status */}
      <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
            <Database className="w-4 h-4 text-blue-600" />
            Sincronizare Cloud (Supabase)
          </h2>
          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            Conectat
          </span>
        </div>

        <p className="text-xs text-slate-600 leading-relaxed">
          Progresul dumneavoastră și temele sunt sincronizate automat în cloud. Pentru actualizare forțată a datelor, apăsați butonul de mai jos:
        </p>

        <div className="flex items-center justify-between pt-1">
          <span className="text-[11px] text-slate-400 font-mono flex items-center gap-1">
            <Clock className="w-3.5 h-3.5" />
            {lastSyncedAt ? new Date(lastSyncedAt).toLocaleTimeString() : 'Recent sincronizat'}
          </span>

          <button
            type="button"
            onClick={() => syncAllFromDatabase()}
            disabled={isSyncing}
            className={`px-3 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
              isSyncing
                ? 'bg-blue-50 border-blue-200 text-blue-600'
                : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700'
            }`}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin text-blue-600' : ''}`} />
            <span>{isSyncing ? 'Sincronizare...' : 'Sincronizează acum'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

