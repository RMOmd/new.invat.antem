import React, { useState } from 'react';
import { useAuth, UserRole } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { LanguageSwitcher } from './LanguageSwitcher';
import {
  isSupabaseConfigured,
  getSavedSupabaseConfig,
  saveSupabaseConfig,
  clearSupabaseConfig,
  testSupabaseConnection
} from '../lib/supabase';
import {
  User,
  LogOut,
  RefreshCw,
  Shield,
  ShieldCheck,
  GraduationCap,
  Award,
  Search,
  Trash2,
  Database,
  CheckCircle2,
  AlertCircle,
  Key,
  Link as LinkIcon,
  UploadCloud,
  Sparkles
} from 'lucide-react';

interface NavbarProps {
  onBackToCourse?: () => void;
  isInsideExercise?: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({ onBackToCourse, isInsideExercise }) => {
  const { currentUser, usersList, changeUserRole, deleteUser, refreshUsersList, syncLocalUsersToSupabase, logout } = useAuth();
  const { t } = useLanguage();

  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showAdminModal, setShowAdminModal] = useState(false);

  // Admin search state
  const [adminSearch, setAdminSearch] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<string | null>(null);
  const [adminTab, setAdminTab] = useState<'users' | 'database'>('users');
  const [sbUrl, setSbUrl] = useState(() => getSavedSupabaseConfig().url);
  const [sbKey, setSbKey] = useState(() => getSavedSupabaseConfig().anonKey);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [isTesting, setIsTesting] = useState(false);

  const isAdmin = currentUser?.role === 'admin';

  const handleTestConnection = async () => {
    setIsTesting(true);
    setTestResult(null);
    try {
      const res = await testSupabaseConnection(sbUrl.trim(), sbKey.trim());
      setTestResult(res);
    } finally {
      setIsTesting(false);
    }
  };

  const handleSaveSupabase = () => {
    saveSupabaseConfig({
      url: sbUrl.trim(),
      anonKey: sbKey.trim()
    });
  };

  const handleClearSupabase = () => {
    clearSupabaseConfig();
  };

  const handleRefreshUsers = async () => {
    setIsRefreshing(true);
    try {
      await refreshUsersList();
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleSyncToSupabase = async () => {
    setIsSyncing(true);
    setSyncStatus(null);
    try {
      const res = await syncLocalUsersToSupabase();
      if (res.error) {
        setSyncStatus(`Error: ${res.error}`);
      } else {
        setSyncStatus(`OK: ${res.count} utilizatori sincronizați cu Supabase!`);
      }
    } finally {
      setIsSyncing(false);
    }
  };

  const filteredUsers = usersList.filter(u =>
    u.name.toLowerCase().includes(adminSearch.toLowerCase()) ||
    u.email.toLowerCase().includes(adminSearch.toLowerCase())
  );

  return (
    <>
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200">
        <div className="max-w-4xl mx-auto px-4 h-14 sm:h-16 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 cursor-pointer" onClick={onBackToCourse}>
            <span className="w-2.5 h-2.5 rounded-full bg-blue-600"></span>
            <div>
              <span className="font-extrabold text-base sm:text-lg text-slate-900 tracking-tight leading-none block">
                Limba Română
              </span>
              <span className="text-[10px] font-semibold text-blue-600 block uppercase tracking-wider">
                {t('course_level_badge')}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2">
            {/* Language Switcher */}
            <LanguageSwitcher />

            {/* Admin Panel button (Only visible to admin) */}
            {isAdmin && (
              <button
                type="button"
                onClick={() => setShowAdminModal(true)}
                className="flex items-center gap-1 px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                title={t('admin_panel_title')}
              >
                <ShieldCheck className="w-4 h-4 text-rose-600" />
                <span className="hidden sm:inline">{t('btn_admin_panel')}</span>
              </button>
            )}

            {/* Current User Profile button (Opens only their own profile) */}
            <button
              type="button"
              onClick={() => setShowProfileModal(true)}
              className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors text-xs font-semibold text-slate-800 cursor-pointer"
            >
              <div className={`w-5 h-5 rounded-full text-white flex items-center justify-center text-[10px] font-bold ${
                currentUser?.role === 'admin'
                  ? 'bg-rose-600'
                  : currentUser?.role === 'teacher'
                  ? 'bg-purple-600'
                  : currentUser?.role === 'demo'
                  ? 'bg-amber-600'
                  : 'bg-blue-600'
              }`}>
                {currentUser?.name.charAt(0).toUpperCase() || 'U'}
              </div>
              <span className="max-w-[80px] sm:max-w-[110px] truncate">{currentUser?.name}</span>
            </button>

            {/* Direct Logout Button */}
            <button
              type="button"
              onClick={logout}
              title={t('btn_logout')}
              className="p-1.5 sm:p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* USER'S OWN PROFILE MODAL (Only shows their own profile, no other accounts!) */}
      {showProfileModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <User className="w-5 h-5 text-blue-600" />
                {t('user_profile_modal_title')}
              </h2>
              <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider ${
                currentUser?.role === 'admin'
                  ? 'bg-rose-100 text-rose-700'
                  : currentUser?.role === 'teacher'
                  ? 'bg-purple-100 text-purple-700'
                  : currentUser?.role === 'demo'
                  ? 'bg-amber-100 text-amber-800'
                  : 'bg-blue-100 text-blue-700'
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

            <p className="text-xs text-slate-500 mb-5">
              {t('user_profile_modal_desc')}
            </p>

            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-3 mb-6">
              <div>
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">
                  {t('auth_name_label')}
                </span>
                <span className="text-base font-bold text-slate-900 block">
                  {currentUser?.name}
                </span>
              </div>

              <div>
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">
                  {t('auth_email_label')}
                </span>
                <span className="text-sm font-mono text-slate-700 block">
                  {currentUser?.email}
                </span>
              </div>

              <div>
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">
                  {t('auth_account_type_label')}
                </span>
                <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-800">
                  {currentUser?.role === 'admin' && <Shield className="w-4 h-4 text-rose-600" />}
                  {currentUser?.role === 'teacher' && <Award className="w-4 h-4 text-purple-600" />}
                  {currentUser?.role === 'demo' && <Sparkles className="w-4 h-4 text-amber-600" />}
                  {currentUser?.role === 'student' && <GraduationCap className="w-4 h-4 text-blue-600" />}
                  <span>
                    {currentUser?.role === 'admin'
                      ? t('role_admin')
                      : currentUser?.role === 'teacher'
                      ? t('role_teacher')
                      : currentUser?.role === 'demo'
                      ? t('role_demo')
                      : t('role_student')}
                  </span>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <button
                type="button"
                onClick={() => {
                  logout();
                  setShowProfileModal(false);
                }}
                className="w-full py-2.5 px-4 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 font-bold rounded-xl text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
                {t('btn_logout')}
              </button>

              <button
                type="button"
                onClick={() => setShowProfileModal(false)}
                className="w-full py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs cursor-pointer"
              >
                {t('btn_close')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ADMIN PANEL MODAL (Only accessible by Administrator to manage roles & Supabase) */}
      {showAdminModal && isAdmin && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-5 sm:p-6 shadow-2xl border border-slate-200 max-h-[92vh] flex flex-col">
            <div className="flex items-center justify-between gap-2 mb-3 pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-6 h-6 text-rose-600" />
                <div>
                  <h2 className="text-lg font-bold text-slate-900 leading-tight">
                    {t('admin_panel_title')}
                  </h2>
                  <p className="text-xs text-slate-500">
                    {t('admin_panel_desc')}
                  </p>
                </div>
              </div>

              {adminTab === 'users' && (
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={handleSyncToSupabase}
                    disabled={isSyncing}
                    className="py-1.5 px-2.5 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-blue-50 hover:text-blue-600 rounded-xl transition-all cursor-pointer flex items-center gap-1.5"
                    title={t('btn_sync_to_supabase')}
                  >
                    <UploadCloud className={`w-3.5 h-3.5 ${isSyncing ? 'animate-bounce' : ''}`} />
                    <span className="hidden sm:inline">{t('btn_sync_to_supabase')}</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleRefreshUsers}
                    disabled={isRefreshing}
                    className="p-2 text-slate-500 hover:text-blue-600 hover:bg-slate-100 rounded-xl transition-all cursor-pointer"
                    title="Sincronizează din Supabase"
                  >
                    <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                  </button>
                </div>
              )}
            </div>

            {/* Admin Tabs */}
            <div className="flex bg-slate-100 p-1 rounded-2xl mb-3 shrink-0">
              <button
                type="button"
                onClick={() => setAdminTab('users')}
                className={`flex-1 py-1.5 px-3 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  adminTab === 'users' ? 'bg-white text-blue-600 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <User className="w-3.5 h-3.5" />
                {t('admin_tab_users')} ({usersList.length})
              </button>
              <button
                type="button"
                onClick={() => setAdminTab('database')}
                className={`flex-1 py-1.5 px-3 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  adminTab === 'database' ? 'bg-white text-blue-600 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Database className="w-3.5 h-3.5" />
                {t('admin_tab_database')}
                <span className={`w-2 h-2 rounded-full ${isSupabaseConfigured() ? 'bg-emerald-500' : 'bg-amber-500'}`}></span>
              </button>
            </div>

            {adminTab === 'users' ? (
              <>
                {/* Search filter */}
                <div className="relative mb-3 shrink-0">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={adminSearch}
                    onChange={e => setAdminSearch(e.target.value)}
                    placeholder={t('search_users')}
                    className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {syncStatus && (
                  <div className={`mb-3 p-2.5 rounded-xl border text-xs flex items-center gap-2 ${
                    syncStatus.startsWith('OK')
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                      : 'bg-rose-50 border-rose-200 text-rose-800'
                  }`}>
                    {syncStatus.startsWith('OK') ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                    )}
                    <span>{syncStatus}</span>
                  </div>
                )}

                {/* Users list */}
                <div className="flex-1 overflow-y-auto space-y-2 pr-1 my-1 max-h-[50vh]">
                  {filteredUsers.map(u => {
                    const isCurrentAdmin = u.id === currentUser?.id;

                    return (
                      <div
                        key={u.id}
                        className="p-3 bg-slate-50/70 border border-slate-200/80 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 transition-all"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-slate-900 truncate">
                              {u.name}
                            </span>
                            <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                              u.role === 'admin'
                                ? 'bg-rose-100 text-rose-700'
                                : u.role === 'teacher'
                                ? 'bg-purple-100 text-purple-700'
                                : 'bg-blue-100 text-blue-700'
                            }`}>
                              {u.role === 'admin'
                                ? t('role_admin')
                                : u.role === 'teacher'
                                ? t('role_teacher')
                                : t('role_student')}
                            </span>
                          </div>
                          <span className="text-[11px] text-slate-500 font-mono block truncate">
                            {u.email}
                          </span>
                        </div>

                        {/* Role changer buttons */}
                        <div className="flex items-center gap-1.5 self-end sm:self-auto shrink-0">
                          {!isCurrentAdmin && (
                            <>
                              {u.role === 'student' ? (
                                <button
                                  type="button"
                                  onClick={() => changeUserRole(u.id, 'teacher')}
                                  className="px-2.5 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-[11px] font-bold transition-colors cursor-pointer flex items-center gap-1 shadow-2xs"
                                >
                                  <Award className="w-3.5 h-3.5" />
                                  {t('btn_make_teacher')}
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => changeUserRole(u.id, 'student')}
                                  className="px-2.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-[11px] font-bold transition-colors cursor-pointer flex items-center gap-1 shadow-2xs"
                                >
                                  <GraduationCap className="w-3.5 h-3.5" />
                                  {t('btn_make_student')}
                                </button>
                              )}

                              <button
                                type="button"
                                onClick={() => {
                                  if (confirm(`Sigur doriți să ștergeți utilizatorul ${u.name}?`)) {
                                    deleteUser(u.id);
                                  }
                                }}
                                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                                title="Șterge utilizator"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}
                          {isCurrentAdmin && (
                            <span className="text-[10px] text-slate-400 font-semibold italic">
                              (Contul tău)
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            ) : (
              /* Database / Supabase configuration tab */
              <div className="flex-1 overflow-y-auto space-y-3.5 pr-1 my-1">
                <div className={`p-3.5 rounded-2xl border text-xs flex items-start gap-2.5 ${
                  isSupabaseConfigured()
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                    : 'bg-amber-50 border-amber-200 text-amber-800'
                }`}>
                  {isSupabaseConfigured() ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  )}
                  <div>
                    <span className="font-bold block">
                      {isSupabaseConfigured() ? t('sb_status_connected') : t('sb_status_local')}
                    </span>
                    <span className="text-[11px] opacity-90 block mt-0.5">
                      {isSupabaseConfigured()
                        ? `Supabase este activ. Progresul și conturile se sincronizează în cloud.`
                        : `Supabase nu este configurat. Datele se păstrează doar local în browserul fiecărui vizitator.`}
                    </span>
                  </div>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1 flex items-center gap-1.5">
                      <LinkIcon className="w-3.5 h-3.5 text-slate-500" />
                      {t('sb_url_label')}
                    </label>
                    <input
                      type="text"
                      value={sbUrl}
                      onChange={e => setSbUrl(e.target.value)}
                      placeholder="https://xyzcompany.supabase.co"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1 flex items-center gap-1.5">
                      <Key className="w-3.5 h-3.5 text-slate-500" />
                      {t('sb_anon_label')}
                    </label>
                    <input
                      type="password"
                      value={sbKey}
                      onChange={e => setSbKey(e.target.value)}
                      placeholder="eyJhbGciOi..."
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                {testResult && (
                  <div className={`p-2.5 rounded-xl border text-xs flex items-center gap-2 ${
                    testResult.success
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                      : 'bg-rose-50 border-rose-200 text-rose-800'
                  }`}>
                    {testResult.success ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                    )}
                    <span>{testResult.message}</span>
                  </div>
                )}

                <div className="flex flex-wrap gap-2 pt-1">
                  <button
                    type="button"
                    onClick={handleTestConnection}
                    disabled={isTesting}
                    className="py-2 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isTesting ? 'animate-spin' : ''}`} />
                    {t('sb_btn_test')}
                  </button>

                  <button
                    type="button"
                    onClick={handleSaveSupabase}
                    className="py-2 px-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    {t('sb_btn_save')}
                  </button>

                  {isSupabaseConfigured() && (
                    <button
                      type="button"
                      onClick={handleClearSupabase}
                      className="py-2 px-3 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold rounded-xl text-xs transition-colors cursor-pointer ml-auto"
                    >
                      {t('sb_btn_disconnect')}
                    </button>
                  )}
                </div>
              </div>
            )}

            <div className="pt-3 border-t border-slate-100 flex justify-end shrink-0">
              <button
                type="button"
                onClick={() => setShowAdminModal(false)}
                className="py-2 px-5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs cursor-pointer"
              >
                {t('btn_close')}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
