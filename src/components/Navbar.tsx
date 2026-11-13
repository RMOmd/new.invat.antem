import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { LanguageSwitcher } from './LanguageSwitcher';
import {
  getSavedSupabaseConfig,
  saveSupabaseConfig,
  isSupabaseConfigured,
  clearSupabaseConfig,
  testSupabaseConnection
} from '../lib/supabase';
import { User, Settings, Database, Plus, Check, LogOut, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react';

interface NavbarProps {
  onBackToCourse?: () => void;
  isInsideExercise?: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({ onBackToCourse, isInsideExercise }) => {
  const { currentUser, usersList, loginAs, createNewUser, logout } = useAuth();
  const { t } = useLanguage();
  const [showUserModal, setShowUserModal] = useState(false);
  const [showConfigModal, setShowConfigModal] = useState(false);

  // New user form state
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newRole, setNewRole] = useState<'student' | 'teacher'>('student');

  // Supabase config state
  const [sbConfig, setSbConfig] = useState(getSavedSupabaseConfig());
  const [testingConnection, setTestingConnection] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  const isConfigured = isSupabaseConfigured();

  const handleTestConnection = async () => {
    setTestingConnection(true);
    setTestResult(null);
    try {
      const res = await testSupabaseConnection(sbConfig.url, sbConfig.anonKey);
      setTestResult(res);
    } finally {
      setTestingConnection(false);
    }
  };

  const handleCreateUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !newEmail.trim()) return;
    createNewUser(newName.trim(), newEmail.trim(), newRole);
    setNewName('');
    setNewEmail('');
    setShowUserModal(false);
  };

  const handleSaveSbConfig = (e: React.FormEvent) => {
    e.preventDefault();
    saveSupabaseConfig(sbConfig);
  };

  return (
    <>
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200">
        <div className="max-w-4xl mx-auto px-4 h-14 sm:h-16 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 cursor-pointer" onClick={onBackToCourse}>
            <span className="text-2xl leading-none">🇷🇴</span>
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

            {/* Supabase status / config button */}
            <button
              type="button"
              onClick={() => {
                setTestResult(null);
                setShowConfigModal(true);
              }}
              className="p-1.5 sm:p-2 text-slate-500 hover:text-blue-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer relative"
              title={isConfigured ? 'Supabase: Conectat (Cloud)' : t('sb_modal_title')}
            >
              <Database className={`w-4 h-4 sm:w-5 sm:h-5 ${isConfigured ? 'text-emerald-600' : 'text-slate-500'}`} />
              {isConfigured && (
                <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-emerald-500 ring-2 ring-white" />
              )}
            </button>

            {/* User profile button */}
            <button
              type="button"
              onClick={() => setShowUserModal(true)}
              className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors text-xs font-semibold text-slate-800 cursor-pointer"
            >
              <div className={`w-5 h-5 rounded-full text-white flex items-center justify-center text-[10px] font-bold ${
                currentUser?.role === 'teacher' ? 'bg-purple-600' : 'bg-blue-600'
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

      {/* User Switcher / Management Modal */}
      {showUserModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
            <h2 className="text-lg font-bold text-slate-900 mb-1 flex items-center gap-2">
              <User className="w-5 h-5 text-blue-600" />
              {t('user_modal_title')}
            </h2>
            <p className="text-xs text-slate-500 mb-4">
              {t('user_modal_desc')}
            </p>

            <div className="space-y-2 mb-4 max-h-52 overflow-y-auto">
              {usersList.map(u => (
                <div
                  key={u.id}
                  onClick={() => {
                    loginAs(u);
                    setShowUserModal(false);
                  }}
                  className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                    currentUser?.id === u.id
                      ? 'border-blue-500 bg-blue-50/60 ring-2 ring-blue-500/20'
                      : 'border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <div>
                    <span className="text-sm font-bold text-slate-900 block">{u.name}</span>
                    <span className="text-xs text-slate-500 font-mono">{u.email}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                      u.role === 'teacher' ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'
                    }`}>
                      {u.role === 'teacher' ? t('role_teacher') : t('role_student')}
                    </span>
                    {currentUser?.id === u.id && <Check className="w-4 h-4 text-blue-600" />}
                  </div>
                </div>
              ))}
            </div>

            {/* Logout button */}
            <div className="mb-4">
              <button
                type="button"
                onClick={() => {
                  logout();
                  setShowUserModal(false);
                }}
                className="w-full py-2 px-3 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 font-bold rounded-xl text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                {t('btn_logout_from')} ({currentUser?.name})
              </button>
            </div>

            {/* Create new user form */}
            <form onSubmit={handleCreateUser} className="border-t border-slate-100 pt-4 space-y-3">
              <span className="text-xs font-bold text-slate-700 block uppercase tracking-wider">
                {t('user_modal_add_title')}
              </span>
              <input
                type="text"
                placeholder={t('user_modal_name_ph')}
                value={newName}
                onChange={e => setNewName(e.target.value)}
                className="w-full text-sm px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
              <input
                type="email"
                placeholder={t('user_modal_email_ph')}
                value={newEmail}
                onChange={e => setNewEmail(e.target.value)}
                className="w-full text-sm px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
              <div className="flex gap-4 text-xs font-semibold">
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="radio"
                    name="role"
                    checked={newRole === 'student'}
                    onChange={() => setNewRole('student')}
                  />
                  {t('role_student')}
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="radio"
                    name="role"
                    checked={newRole === 'teacher'}
                    onChange={() => setNewRole('teacher')}
                  />
                  {t('role_teacher')}
                </label>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1 cursor-pointer"
                >
                  <Plus className="w-4 h-4" /> {t('user_modal_btn_create')}
                </button>
                <button
                  type="button"
                  onClick={() => setShowUserModal(false)}
                  className="py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs cursor-pointer"
                >
                  {t('btn_close')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Supabase Connection Modal */}
      {showConfigModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between gap-2 mb-1">
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Database className="w-5 h-5 text-emerald-600" />
                {t('sb_modal_title')}
              </h2>
              <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider flex items-center gap-1 ${
                isConfigured ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'
              }`}>
                {isConfigured ? '● Conectat' : 'Mod local'}
              </span>
            </div>
            <p className="text-xs text-slate-500 mb-4">
              {t('sb_modal_desc')}
            </p>

            {testResult && (
              <div className={`mb-3 p-2.5 rounded-xl text-xs flex items-center gap-2 ${
                testResult.success
                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                  : 'bg-rose-50 text-rose-800 border border-rose-200'
              }`}>
                {testResult.success ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
                <span>{testResult.message}</span>
              </div>
            )}

            <form onSubmit={handleSaveSbConfig} className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Project URL:</label>
                <input
                  type="text"
                  placeholder="https://xyzcompany.supabase.co"
                  value={sbConfig.url}
                  onChange={e => setSbConfig({ ...sbConfig, url: e.target.value })}
                  className="w-full text-xs font-mono px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Anon Public Key:</label>
                <textarea
                  rows={3}
                  placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                  value={sbConfig.anonKey}
                  onChange={e => setSbConfig({ ...sbConfig, anonKey: e.target.value })}
                  className="w-full text-xs font-mono px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleTestConnection}
                  disabled={testingConnection || !sbConfig.url || !sbConfig.anonKey}
                  className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer disabled:opacity-40"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${testingConnection ? 'animate-spin' : ''}`} />
                  {testingConnection ? 'Se testează...' : 'Testează conexiunea'}
                </button>

                {isConfigured && (
                  <button
                    type="button"
                    onClick={clearSupabaseConfig}
                    className="py-2 px-3 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold rounded-xl text-xs transition-colors cursor-pointer"
                  >
                    Deconectează
                  </button>
                )}
              </div>

              <div className="p-3 bg-slate-50 rounded-xl text-[11px] text-slate-600 leading-relaxed">
                💡 <em>{t('sb_modal_note')}</em>
              </div>

              <div className="flex gap-2 pt-1">
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs cursor-pointer shadow-xs"
                >
                  {t('btn_save_reload')}
                </button>
                <button
                  type="button"
                  onClick={() => setShowConfigModal(false)}
                  className="py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs cursor-pointer"
                >
                  {t('btn_close')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};

