import React, { useState } from 'react';
import { useAuth, UserProfile } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { LanguageSwitcher } from './LanguageSwitcher';
import {
  Mail,
  Lock,
  User,
  GraduationCap,
  Sparkles,
  ArrowRight,
  Eye,
  EyeOff,
  AlertCircle,
  CheckCircle2,
  ShieldCheck,
  BookOpen,
  Award
} from 'lucide-react';

export const AuthView: React.FC = () => {
  const { loginWithCredentials, registerWithCredentials, loginAs, usersList } = useAuth();
  const { t } = useLanguage();

  const [activeTab, setActiveTab] = useState<'login' | 'register'>('login');

  // Login form state
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);

  // Register form state
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirmPassword, setRegConfirmPassword] = useState('');
  const [regRole, setRegRole] = useState<'student' | 'teacher'>('student');
  const [showRegPassword, setShowRegPassword] = useState(false);

  // UI state
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!loginEmail.trim() || !loginPassword.trim()) {
      setErrorMessage(t('auth_err_required_fields'));
      return;
    }

    setLoading(true);
    try {
      const res = await loginWithCredentials(loginEmail, loginPassword);
      if (!res.success) {
        setErrorMessage(res.error || t('auth_err_required_fields'));
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Error');
    } finally {
      setLoading(false);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!regName.trim()) {
      setErrorMessage(t('auth_name_label'));
      return;
    }
    if (!regEmail.trim() || !regEmail.includes('@')) {
      setErrorMessage(t('auth_err_invalid_email'));
      return;
    }
    if (regPassword.length < 6) {
      setErrorMessage(t('auth_err_short_pass'));
      return;
    }
    if (regPassword !== regConfirmPassword) {
      setErrorMessage(t('auth_err_pass_mismatch'));
      return;
    }

    setLoading(true);
    try {
      const res = await registerWithCredentials(regName, regEmail, regPassword, regRole);
      if (!res.success) {
        setErrorMessage(res.error || 'Error');
      } else {
        setSuccessMessage(t('auth_success_registered'));
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Error');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickDemoLogin = (user: UserProfile) => {
    setErrorMessage(null);
    loginAs(user);
  };

  return (
    <div className="min-h-screen bg-linear-to-b from-slate-100 via-blue-50/40 to-slate-100 flex flex-col justify-between py-6 px-4 sm:px-6 lg:px-8">
      {/* Top Header / Language Switcher & Branding */}
      <div className="max-w-md w-full mx-auto">
        <div className="flex items-center justify-end mb-2">
          <LanguageSwitcher />
        </div>

        <div className="text-center pt-1 pb-4">
          <div className="inline-flex items-center justify-center gap-2 mb-2 bg-white px-3.5 py-1.5 rounded-full border border-slate-200/80 shadow-2xs">
            <span className="text-xl leading-none">🇷🇴</span>
            <span className="text-xs font-bold text-slate-800 tracking-wide uppercase">
              {t('auth_badge')}
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            {t('auth_title')}
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 mt-1 max-w-sm mx-auto">
            {t('auth_subtitle')}
          </p>
        </div>
      </div>

      {/* Main Auth Card */}
      <div className="max-w-md w-full mx-auto bg-white rounded-3xl shadow-xl shadow-slate-200/60 border border-slate-200/80 overflow-hidden">
        {/* Tab Switcher */}
        <div className="flex border-b border-slate-200 bg-slate-50/80 p-1.5">
          <button
            type="button"
            onClick={() => {
              setActiveTab('login');
              setErrorMessage(null);
            }}
            className={`flex-1 py-2.5 text-xs sm:text-sm font-bold rounded-2xl transition-all flex items-center justify-center gap-2 cursor-pointer ${
              activeTab === 'login'
                ? 'bg-white text-blue-600 shadow-sm'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Lock className="w-4 h-4" />
            {t('auth_tab_login')}
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab('register');
              setErrorMessage(null);
            }}
            className={`flex-1 py-2.5 text-xs sm:text-sm font-bold rounded-2xl transition-all flex items-center justify-center gap-2 cursor-pointer ${
              activeTab === 'register'
                ? 'bg-white text-blue-600 shadow-sm'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <User className="w-4 h-4" />
            {t('auth_tab_register')}
          </button>
        </div>

        <div className="p-5 sm:p-7">
          {/* Notification Messages */}
          {errorMessage && (
            <div className="mb-4 p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-2xl text-xs flex items-start gap-2.5 animate-fadeIn">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {successMessage && (
            <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl text-xs flex items-start gap-2.5 animate-fadeIn">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <span>{successMessage}</span>
            </div>
          )}

          {/* TAB 1: LOGIN */}
          {activeTab === 'login' && (
            <form onSubmit={handleLoginSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  {t('auth_email_label')}
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Mail className="w-4 h-4" />
                  </div>
                  <input
                    type="email"
                    value={loginEmail}
                    onChange={e => setLoginEmail(e.target.value)}
                    placeholder={t('auth_email_ph')}
                    autoComplete="email"
                    className="w-full pl-10 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all text-slate-900"
                    required
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-bold text-slate-700">
                    {t('auth_pass_label')}
                  </label>
                  <span className="text-[11px] text-slate-400">
                    {t('auth_pass_demo_hint')}
                  </span>
                </div>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    type={showLoginPassword ? 'text' : 'password'}
                    value={loginPassword}
                    onChange={e => setLoginPassword(e.target.value)}
                    placeholder={t('auth_pass_ph')}
                    autoComplete="current-password"
                    className="w-full pl-10 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all text-slate-900"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowLoginPassword(!showLoginPassword)}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 focus:outline-none cursor-pointer"
                  >
                    {showLoginPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between text-xs text-slate-600 pt-1">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={e => setRememberMe(e.target.checked)}
                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span>{t('auth_remember_me')}</span>
                </label>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 px-4 bg-linear-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 active:scale-[0.99] text-white font-bold rounded-2xl text-sm shadow-md shadow-blue-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {loading ? (
                  <span>{t('auth_btn_checking')}</span>
                ) : (
                  <>
                    <span>{t('auth_btn_login')}</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>

              {/* Fast Demo Access */}
              <div className="pt-4 border-t border-slate-100">
                <div className="flex items-center gap-2 mb-2.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    {t('auth_quick_demo_title')}
                  </span>
                </div>

                <div className="space-y-1.5">
                  {usersList.slice(0, 3).map(u => (
                    <button
                      key={u.id}
                      type="button"
                      onClick={() => handleQuickDemoLogin(u)}
                      className="w-full p-2.5 bg-slate-50 hover:bg-blue-50/70 border border-slate-200/80 hover:border-blue-300 rounded-xl flex items-center justify-between text-left transition-all group cursor-pointer"
                    >
                      <div className="flex items-center gap-2.5">
                        <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold text-white shadow-2xs ${
                          u.role === 'teacher' ? 'bg-purple-600' : 'bg-blue-600'
                        }`}>
                          {u.name.charAt(0)}
                        </div>
                        <div>
                          <div className="text-xs font-bold text-slate-800 group-hover:text-blue-600 transition-colors">
                            {u.name}
                          </div>
                          <div className="text-[10px] text-slate-500 font-mono">
                            {u.email}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                          u.role === 'teacher' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'
                        }`}>
                          {u.role === 'teacher' ? t('role_teacher') : t('role_student')}
                        </span>
                        <ArrowRight className="w-3 h-3 text-slate-400 group-hover:text-blue-600 group-hover:translate-x-0.5 transition-all" />
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </form>
          )}

          {/* TAB 2: REGISTER */}
          {activeTab === 'register' && (
            <form onSubmit={handleRegisterSubmit} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {t('auth_name_label')}
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <User className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    value={regName}
                    onChange={e => setRegName(e.target.value)}
                    placeholder={t('auth_name_ph')}
                    autoComplete="name"
                    className="w-full pl-10 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all text-slate-900"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {t('auth_email_label')}
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Mail className="w-4 h-4" />
                  </div>
                  <input
                    type="email"
                    value={regEmail}
                    onChange={e => setRegEmail(e.target.value)}
                    placeholder={t('auth_email_ph')}
                    autoComplete="email"
                    className="w-full pl-10 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all text-slate-900"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    {t('auth_pass_label')}
                  </label>
                  <div className="relative">
                    <input
                      type={showRegPassword ? 'text' : 'password'}
                      value={regPassword}
                      onChange={e => setRegPassword(e.target.value)}
                      placeholder={t('auth_pass_min_hint')}
                      autoComplete="new-password"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all text-slate-900"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    {t('auth_confirm_pass_label')}
                  </label>
                  <div className="relative">
                    <input
                      type={showRegPassword ? 'text' : 'password'}
                      value={regConfirmPassword}
                      onChange={e => setRegConfirmPassword(e.target.value)}
                      placeholder={t('auth_confirm_pass_ph')}
                      autoComplete="new-password"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all text-slate-900"
                      required
                    />
                  </div>
                </div>
              </div>

              <div className="text-right">
                <button
                  type="button"
                  onClick={() => setShowRegPassword(!showRegPassword)}
                  className="text-[11px] text-slate-500 hover:text-slate-800 cursor-pointer"
                >
                  {showRegPassword ? t('auth_hide_pass') : t('auth_show_pass')}
                </button>
              </div>

              {/* Role Selection */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  {t('auth_account_type_label')}
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <div
                    onClick={() => setRegRole('student')}
                    className={`p-2.5 rounded-xl border cursor-pointer transition-all flex flex-col justify-between ${
                      regRole === 'student'
                        ? 'border-blue-500 bg-blue-50/70 ring-2 ring-blue-500/20'
                        : 'border-slate-200 bg-slate-50 hover:bg-slate-100'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 mb-1">
                      <GraduationCap className={`w-4 h-4 ${regRole === 'student' ? 'text-blue-600' : 'text-slate-500'}`} />
                      <span className="text-xs font-bold text-slate-800">{t('role_student')}</span>
                    </div>
                    <span className="text-[10px] text-slate-500 leading-tight">
                      {t('auth_student_desc')}
                    </span>
                  </div>

                  <div
                    onClick={() => setRegRole('teacher')}
                    className={`p-2.5 rounded-xl border cursor-pointer transition-all flex flex-col justify-between ${
                      regRole === 'teacher'
                        ? 'border-purple-500 bg-purple-50/70 ring-2 ring-purple-500/20'
                        : 'border-slate-200 bg-slate-50 hover:bg-slate-100'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 mb-1">
                      <Award className={`w-4 h-4 ${regRole === 'teacher' ? 'text-purple-600' : 'text-slate-500'}`} />
                      <span className="text-xs font-bold text-slate-800">{t('role_teacher')}</span>
                    </div>
                    <span className="text-[10px] text-slate-500 leading-tight">
                      {t('auth_teacher_desc')}
                    </span>
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full mt-2 py-3 px-4 bg-linear-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 active:scale-[0.99] text-white font-bold rounded-2xl text-sm shadow-md shadow-emerald-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {loading ? (
                  <span>{t('auth_btn_creating')}</span>
                ) : (
                  <>
                    <span>{t('auth_btn_register')}</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          )}
        </div>

        {/* Feature Badges Footer */}
        <div className="bg-slate-50 border-t border-slate-100 px-6 py-3.5 flex items-center justify-between text-[11px] text-slate-500">
          <div className="flex items-center gap-1.5">
            <BookOpen className="w-3.5 h-3.5 text-blue-600" />
            <span>{t('auth_footer_units')}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span>{t('auth_footer_auto_save')}</span>
          </div>
        </div>
      </div>

      {/* Footer copyright */}
      <div className="max-w-md w-full mx-auto text-center pt-4 pb-2 text-[11px] text-slate-400">
        {t('auth_footer_copyright')}
      </div>
    </div>
  );
};
