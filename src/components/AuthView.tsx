import React, { useState } from 'react';
import { useAuth, UserProfile } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { LanguageSwitcher } from './LanguageSwitcher';
import { isSupabaseConfigured } from '../lib/supabase';
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
  Award,
  Key,
  X
} from 'lucide-react';

export const AuthView: React.FC = () => {
  const {
    loginWithCredentials,
    registerWithCredentials,
    loginAs,
    usersList,
    resetPasswordForEmail,
    updateUserPassword,
    isPasswordRecoveryMode,
    setIsPasswordRecoveryMode
  } = useAuth();
  const { t } = useLanguage();

  const [activeTab, setActiveTab] = useState<'login' | 'register'>('login');

  // Login form state
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);

  // Recovery modal state
  const [showRecoveryModal, setShowRecoveryModal] = useState(false);
  const [recoveryEmail, setRecoveryEmail] = useState('');
  const [recoveryLoading, setRecoveryLoading] = useState(false);
  const [recoveryStatus, setRecoveryStatus] = useState<{ ok: boolean; msg: string } | null>(null);

  // Set new password state (for recovery mode)
  const [newPassInput, setNewPassInput] = useState('');
  const [confirmNewPassInput, setConfirmNewPassInput] = useState('');
  const [newPassLoading, setNewPassLoading] = useState(false);
  const [newPassStatus, setNewPassStatus] = useState<{ ok: boolean; msg: string } | null>(null);

  // Register form state
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirmPassword, setRegConfirmPassword] = useState('');
  const [showRegPassword, setShowRegPassword] = useState(false);

  // UI state
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleRecoverySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setRecoveryStatus(null);
    setRecoveryLoading(true);
    try {
      const res = await resetPasswordForEmail(recoveryEmail);
      if (res.success) {
        setRecoveryStatus({ ok: true, msg: res.message || t('auth_recovery_sent_success') });
      } else {
        setRecoveryStatus({ ok: false, msg: res.error || 'Eroare la trimiterea e-mailului' });
      }
    } finally {
      setRecoveryLoading(false);
    }
  };

  const handleSetNewPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setNewPassStatus(null);
    if (newPassInput.length < 6) {
      setNewPassStatus({ ok: false, msg: t('auth_err_short_pass') });
      return;
    }
    if (newPassInput !== confirmNewPassInput) {
      setNewPassStatus({ ok: false, msg: t('auth_err_pass_mismatch') });
      return;
    }

    setNewPassLoading(true);
    try {
      const res = await updateUserPassword(newPassInput);
      if (res.success) {
        setNewPassStatus({ ok: true, msg: t('profile_pass_updated_success') });
        setTimeout(() => {
          setIsPasswordRecoveryMode(false);
          if (typeof window !== 'undefined' && window.history) {
            window.history.replaceState(null, '', window.location.pathname);
          }
        }, 1500);
      } else {
        setNewPassStatus({ ok: false, msg: res.error || 'Eroare la actualizarea parolei' });
      }
    } finally {
      setNewPassLoading(false);
    }
  };

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
      const res = await registerWithCredentials(regName, regEmail, regPassword);
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
    <div
      className="min-h-screen bg-cover bg-[15%_center] sm:bg-[20%_center] lg:bg-left bg-fixed flex flex-col justify-between py-4 sm:py-6 px-4 sm:px-8 lg:px-12 relative overflow-x-hidden"
      style={{
        backgroundImage: "linear-gradient(to right, rgba(15, 23, 42, 0.15) 0%, rgba(15, 23, 42, 0.40) 45%, rgba(15, 23, 42, 0.78) 75%, rgba(15, 23, 42, 0.88) 100%), url('media/stefan_cel_mare_bg.jpg')"
      }}
    >
      {/* Top Header / Language Switcher & Branding */}
      <div className="max-w-7xl w-full mx-auto flex items-center justify-between relative z-20">
        <div className="inline-flex items-center gap-2 bg-slate-900/75 backdrop-blur-md px-3.5 py-1.5 rounded-full border border-amber-400/40 shadow-lg">
          <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse"></span>
          <span className="text-[11px] sm:text-xs font-bold text-amber-300 tracking-wider uppercase">
            {t('auth_badge')}
          </span>
        </div>

        <div className="bg-slate-900/75 backdrop-blur-md p-1 rounded-2xl border border-white/15 shadow-sm">
          <LanguageSwitcher />
        </div>
      </div>

      {/* Main Two-Column Layout (Stefan on left, Login card on right) */}
      <div className="max-w-7xl w-full mx-auto my-auto py-6 sm:py-8 lg:py-12 flex flex-col lg:flex-row items-center justify-between gap-8 lg:gap-12 relative z-10">
        
        {/* Left Column: Hero branding with clear visibility of Stefan cel Mare */}
        <div className="w-full lg:max-w-xl text-center lg:text-left text-white space-y-4">
          <div className="inline-block">
            <span className="text-xs font-bold uppercase tracking-widest text-amber-300/90 bg-amber-500/10 border border-amber-400/30 px-3.5 py-1 rounded-full shadow-xs">
              Ștefan cel Mare • ANTEM
            </span>
          </div>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-white tracking-tight drop-shadow-xl leading-tight">
            {t('auth_title')}
          </h1>
          <p className="text-sm sm:text-base text-blue-100/90 max-w-lg drop-shadow leading-relaxed font-medium mx-auto lg:mx-0">
            {t('auth_subtitle')}
          </p>

          {/* Quick value badges on desktop */}
          <div className="hidden lg:grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 text-xs">
            <div className="flex items-center gap-2.5 bg-slate-900/60 backdrop-blur-md border border-white/10 px-3.5 py-2.5 rounded-2xl shadow-sm">
              <BookOpen className="w-4 h-4 text-amber-300 shrink-0" />
              <span className="text-slate-100 font-semibold">{t('auth_footer_units')}</span>
            </div>
            <div className="flex items-center gap-2.5 bg-slate-900/60 backdrop-blur-md border border-white/10 px-3.5 py-2.5 rounded-2xl shadow-sm">
              <Sparkles className="w-4 h-4 text-blue-300 shrink-0" />
              <span className="text-slate-100 font-semibold">{t('auth_footer_auto_save')}</span>
            </div>
          </div>
        </div>

        {/* Right Column: Main Auth Card */}
        <div className="w-full max-w-md lg:max-w-sm xl:max-w-md shrink-0 lg:ml-auto bg-white rounded-3xl shadow-2xl shadow-slate-950/70 border border-white/90 overflow-hidden relative z-10">
        {/* Tab Switcher */}
        <div className="flex border-b border-slate-200 bg-slate-100/90 p-1.5">
          <button
            type="button"
            onClick={() => {
              setActiveTab('login');
              setErrorMessage(null);
            }}
            className={`flex-1 py-2.5 text-xs sm:text-sm font-bold rounded-2xl transition-all flex items-center justify-center gap-2 cursor-pointer ${
              activeTab === 'login'
                ? 'bg-white text-blue-600 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
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
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <User className="w-4 h-4" />
            {t('auth_tab_register')}
          </button>
        </div>

        <div className="p-5 sm:p-7 bg-white">
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
                <label className="block text-xs font-bold text-slate-800 mb-1.5">
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
                    className="w-full pl-10 pr-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all text-slate-900"
                    required
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-bold text-slate-800">
                    {t('auth_pass_label')}
                  </label>
                  <span className="text-[11px] text-slate-500 font-medium">
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
                    className="w-full pl-10 pr-10 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all text-slate-900"
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

              <div className="flex items-center justify-between text-xs text-slate-700 pt-1">
                <label className="flex items-center gap-2 cursor-pointer select-none font-medium">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={e => setRememberMe(e.target.checked)}
                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span>{t('auth_remember_me')}</span>
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setRecoveryEmail(loginEmail);
                    setRecoveryStatus(null);
                    setShowRecoveryModal(true);
                  }}
                  className="text-xs font-bold text-blue-600 hover:text-blue-800 transition-colors cursor-pointer"
                >
                  {t('auth_forgot_password')}
                </button>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 px-4 bg-blue-600 hover:bg-blue-700 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 active:scale-[0.99] text-white font-bold rounded-2xl text-sm shadow-md shadow-blue-500/25 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
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

              {/* Single Demo Access with Restricted Permissions */}
              <div className="pt-4 border-t border-slate-100">
                <div className="p-3.5 bg-gradient-to-br from-amber-50 to-orange-50/50 border border-amber-200/90 rounded-2xl">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-1.5 text-amber-900 font-bold text-xs">
                      <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                      <span>{t('auth_quick_demo_title')}</span>
                    </div>
                    <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-amber-200 text-amber-900 uppercase tracking-wider">
                      {t('auth_demo_limited_badge')}
                    </span>
                  </div>

                  <p className="text-[11px] text-amber-800/90 mb-2.5 leading-relaxed">
                    {t('auth_demo_guest_desc')}
                  </p>

                  <div className="flex items-center justify-between bg-white/90 px-3 py-1.5 rounded-xl border border-amber-200 text-xs font-mono text-slate-700 mb-2.5">
                    <span>demo@antem.org</span>
                    <span className="text-slate-300">•</span>
                    <span>demo123</span>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setLoginEmail('demo@antem.org');
                      setLoginPassword('demo123');
                      loginWithCredentials('demo@antem.org', 'demo123');
                    }}
                    className="w-full py-2 px-3 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                  >
                    <span>{t('auth_btn_quick_demo')}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </form>
          )}

          {/* TAB 2: REGISTER */}
          {activeTab === 'register' && (
            <form onSubmit={handleRegisterSubmit} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">
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
                    className="w-full pl-10 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all text-slate-900"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">
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
                    className="w-full pl-10 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all text-slate-900"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">
                    {t('auth_pass_label')}
                  </label>
                  <div className="relative">
                    <input
                      type={showRegPassword ? 'text' : 'password'}
                      value={regPassword}
                      onChange={e => setRegPassword(e.target.value)}
                      placeholder={t('auth_pass_min_hint')}
                      autoComplete="new-password"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all text-slate-900"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">
                    {t('auth_confirm_pass_label')}
                  </label>
                  <div className="relative">
                    <input
                      type={showRegPassword ? 'text' : 'password'}
                      value={regConfirmPassword}
                      onChange={e => setRegConfirmPassword(e.target.value)}
                      placeholder={t('auth_confirm_pass_ph')}
                      autoComplete="new-password"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all text-slate-900"
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

              <button
                type="submit"
                disabled={loading}
                className="w-full mt-2 py-3.5 px-4 bg-emerald-600 hover:bg-emerald-700 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 active:scale-[0.99] text-white font-bold rounded-2xl text-sm shadow-md shadow-emerald-500/25 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
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
          <div className="flex items-center gap-1.5 font-medium">
            <span className={`w-2 h-2 rounded-full ${isSupabaseConfigured() ? 'bg-emerald-500' : 'bg-amber-400'}`}></span>
            <span>{isSupabaseConfigured() ? 'Supabase Cloud' : 'Local DB'}</span>
          </div>
        </div>
      </div>

      {/* Close Main Two-Column Layout Container */}
      </div>

      {/* Footer copyright */}
      <div className="max-w-7xl w-full mx-auto text-center lg:text-right pt-4 pb-2 text-[11px] text-slate-300/85 font-medium drop-shadow relative z-10">
        {t('auth_footer_copyright')}
      </div>

      {/* MODAL 1: FORGOT PASSWORD RECOVERY REQUEST */}
      {showRecoveryModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-fadeIn">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Key className="w-5 h-5 text-blue-600" />
                {t('auth_recovery_modal_title')}
              </h2>
              <button
                type="button"
                onClick={() => setShowRecoveryModal(false)}
                className="p-1 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed mb-4">
              {t('auth_recovery_modal_desc')}
            </p>

            {recoveryStatus && (
              <div className={`mb-4 p-3 rounded-2xl text-xs flex items-start gap-2.5 ${
                recoveryStatus.ok
                  ? 'bg-emerald-50 border border-emerald-200 text-emerald-900'
                  : 'bg-rose-50 border border-rose-200 text-rose-900'
              }`}>
                {recoveryStatus.ok ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                )}
                <span>{recoveryStatus.msg}</span>
              </div>
            )}

            {!recoveryStatus?.ok && (
              <form onSubmit={handleRecoverySubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1.5">
                    {t('auth_email_label')}
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                      <Mail className="w-4 h-4" />
                    </div>
                    <input
                      type="email"
                      value={recoveryEmail}
                      onChange={e => setRecoveryEmail(e.target.value)}
                      placeholder={t('auth_email_ph')}
                      className="w-full pl-10 pr-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white text-slate-900"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <button
                    type="submit"
                    disabled={recoveryLoading}
                    className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    {recoveryLoading ? (
                      <span>{t('auth_btn_sending_recovery')}</span>
                    ) : (
                      <span>{t('auth_btn_send_recovery')}</span>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowRecoveryModal(false)}
                    className="w-full py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition-colors cursor-pointer"
                  >
                    {t('btn_close')}
                  </button>
                </div>
              </form>
            )}

            {recoveryStatus?.ok && (
              <button
                type="button"
                onClick={() => setShowRecoveryModal(false)}
                className="w-full py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold rounded-xl text-xs transition-colors cursor-pointer mt-2"
              >
                {t('auth_recovery_back_to_login')}
              </button>
            )}
          </div>
        </div>
      )}

      {/* MODAL 2: SET NEW PASSWORD (When arriving from recovery link email) */}
      {isPasswordRecoveryMode && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-fadeIn">
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2 mb-2">
              <Lock className="w-5 h-5 text-blue-600" />
              {t('auth_set_new_pass_title')}
            </h2>
            <p className="text-xs text-slate-600 leading-relaxed mb-4">
              {t('auth_set_new_pass_desc')}
            </p>

            {newPassStatus && (
              <div className={`mb-4 p-3 rounded-2xl text-xs flex items-start gap-2.5 ${
                newPassStatus.ok
                  ? 'bg-emerald-50 border border-emerald-200 text-emerald-900'
                  : 'bg-rose-50 border border-rose-200 text-rose-900'
              }`}>
                {newPassStatus.ok ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                )}
                <span>{newPassStatus.msg}</span>
              </div>
            )}

            <form onSubmit={handleSetNewPasswordSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1.5">
                  {t('profile_new_pass_label')}
                </label>
                <input
                  type="password"
                  value={newPassInput}
                  onChange={e => setNewPassInput(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white text-slate-900"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1.5">
                  {t('profile_confirm_new_pass_label')}
                </label>
                <input
                  type="password"
                  value={confirmNewPassInput}
                  onChange={e => setConfirmNewPassInput(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white text-slate-900"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={newPassLoading}
                className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <span>{t('auth_btn_save_new_pass')}</span>
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
