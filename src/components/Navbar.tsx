import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { getSavedSupabaseConfig, saveSupabaseConfig } from '../lib/supabase';
import { User, Settings, Database, Plus, Check } from 'lucide-react';

interface NavbarProps {
  onBackToCourse?: () => void;
  isInsideExercise?: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({ onBackToCourse, isInsideExercise }) => {
  const { currentUser, usersList, loginAs, createNewUser } = useAuth();
  const [showUserModal, setShowUserModal] = useState(false);
  const [showConfigModal, setShowConfigModal] = useState(false);

  // New user form state
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newRole, setNewRole] = useState<'student' | 'teacher'>('student');

  // Supabase config state
  const [sbConfig, setSbConfig] = useState(getSavedSupabaseConfig());

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
                Nivelul A1+ • Antem
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Supabase status / config button */}
            <button
              type="button"
              onClick={() => setShowConfigModal(true)}
              className="p-2 text-slate-500 hover:text-blue-600 hover:bg-slate-100 rounded-xl transition-colors"
              title="Setări Supabase / Cloud"
            >
              <Database className="w-5 h-5" />
            </button>

            {/* User switcher button */}
            <button
              type="button"
              onClick={() => setShowUserModal(true)}
              className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors text-xs font-semibold text-slate-800"
            >
              <div className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px] font-bold">
                {currentUser?.name.charAt(0).toUpperCase() || 'U'}
              </div>
              <span className="hidden sm:inline max-w-[120px] truncate">{currentUser?.name}</span>
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
              Conturi de utilizator (Profiluri)
            </h2>
            <p className="text-xs text-slate-500 mb-4">
              Selectați un profil existent sau creați un cont nou pentru a păstra progresul individual.
            </p>

            <div className="space-y-2 mb-6 max-h-52 overflow-y-auto">
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
                      {u.role}
                    </span>
                    {currentUser?.id === u.id && <Check className="w-4 h-4 text-blue-600" />}
                  </div>
                </div>
              ))}
            </div>

            {/* Create new user form */}
            <form onSubmit={handleCreateUser} className="border-t border-slate-100 pt-4 space-y-3">
              <span className="text-xs font-bold text-slate-700 block uppercase tracking-wider">
                Adaugă un utilizator nou:
              </span>
              <input
                type="text"
                placeholder="Nume Prenume (ex: Ion Ceban)"
                value={newName}
                onChange={e => setNewName(e.target.value)}
                className="w-full text-sm px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
              <input
                type="email"
                placeholder="Email (ex: ion@exemplu.md)"
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
                  Student
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="radio"
                    name="role"
                    checked={newRole === 'teacher'}
                    onChange={() => setNewRole('teacher')}
                  />
                  Profesor (Teacher)
                </label>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1"
                >
                  <Plus className="w-4 h-4" /> Crează profil
                </button>
                <button
                  type="button"
                  onClick={() => setShowUserModal(false)}
                  className="py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs"
                >
                  Închide
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
            <h2 className="text-lg font-bold text-slate-900 mb-1 flex items-center gap-2">
              <Database className="w-5 h-5 text-emerald-600" />
              Sincronizare Cloud Supabase
            </h2>
            <p className="text-xs text-slate-500 mb-4">
              Pentru a sincroniza progresul între dispozitive și pe GitHub Pages, introduceți cheile proiectului dumneavoastră gratuit Supabase.
            </p>

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

              <div className="p-3 bg-slate-50 rounded-xl text-[11px] text-slate-600 leading-relaxed">
                💡 <em>Dacă nu introduceți cheile Supabase, aplicația funcționează perfect în mod local (salvează progresul fiecărui student în memoria browserului).</em>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs"
                >
                  Salvează și reîncarcă
                </button>
                <button
                  type="button"
                  onClick={() => setShowConfigModal(false)}
                  className="py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs"
                >
                  Închide
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};

