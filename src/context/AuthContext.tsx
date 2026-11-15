import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { getSupabase } from '../lib/supabase';
import { ActivityProgress, AssignmentSubmission, AIEvaluationResult } from '../types/course';
import { notifyNewSubmission, notifyReviewedSubmission } from '../lib/telegram';

export type UserRole = 'student' | 'teacher' | 'admin' | 'demo';

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  password?: string;
  createdAt?: string;
}

interface AuthContextType {
  currentUser: UserProfile | null;
  usersList: UserProfile[];
  allProgress: Record<string, ActivityProgress>;
  allSubmissions: AssignmentSubmission[];
  loginAs: (user: UserProfile) => void;
  loginWithCredentials: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  registerWithCredentials: (name: string, email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  createNewUser: (name: string, email: string, role: UserRole, password?: string) => UserProfile;
  changeUserRole: (userId: string, newRole: UserRole) => Promise<void>;
  deleteUser: (userId: string) => Promise<void>;
  resetPasswordForEmail: (email: string) => Promise<{ success: boolean; message?: string; error?: string }>;
  updateUserPassword: (newPassword: string) => Promise<{ success: boolean; error?: string }>;
  getStudentProgress: (userId: string) => Promise<Record<string, ActivityProgress>>;
  isPasswordRecoveryMode: boolean;
  setIsPasswordRecoveryMode: (active: boolean) => void;
  refreshUsersList: () => Promise<void>;
  refreshSubmissions: () => Promise<void>;
  syncAllFromDatabase: () => Promise<void>;
  isSyncing: boolean;
  lastSyncedAt: string | null;
  syncLocalUsersToSupabase: () => Promise<{ count: number; error?: string }>;
  logout: () => void;
  saveProgress: (progress: ActivityProgress) => Promise<void>;
  submitAssignment: (activityId: string, activityTitle: string, text: string, aiEvaluation?: AIEvaluationResult) => Promise<void>;
  reviewSubmission: (submissionId: string, grade: number, feedback: string) => Promise<void>;
  deleteSubmission: (submissionId: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const LOCAL_USERS_KEY = 'romanian_platform_users';
const LOCAL_CURRENT_USER_KEY = 'romanian_platform_current_user';
const LOCAL_SUBMISSIONS_KEY = 'romanian_platform_submissions';

export const DEMO_USER: UserProfile = {
  id: 'usr-demo',
  name: 'Cont Demo',
  email: 'demo@antem.org',
  role: 'demo',
  password: 'demo123',
  createdAt: '2026-01-01'
};

export const INITIAL_DEMO_USERS: UserProfile[] = [
  { id: 'usr-admin', name: 'Administrator', email: 'admin@antem.org', role: 'admin', password: 'admin123', createdAt: '2026-01-01' },
  DEMO_USER
];

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [usersList, setUsersList] = useState<UserProfile[]>(() => {
    const saved = localStorage.getItem(LOCAL_USERS_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const list: UserProfile[] = parsed.map(u => ({ ...u, password: u.password || 'password123' }));
          // Ensure admin account always exists
          if (!list.some(u => u.email.toLowerCase() === 'admin@antem.org' || u.role === 'admin')) {
            list.unshift(INITIAL_DEMO_USERS[0]);
          }
          // Ensure demo account always exists
          if (!list.some(u => u.email.toLowerCase() === 'demo@antem.org' || u.role === 'demo')) {
            list.push(DEMO_USER);
          }
          return list;
        }
      } catch (e) {}
    }
    localStorage.setItem(LOCAL_USERS_KEY, JSON.stringify(INITIAL_DEMO_USERS));
    return INITIAL_DEMO_USERS;
  });

  const [currentUser, setCurrentUser] = useState<UserProfile | null>(() => {
    const saved = localStorage.getItem(LOCAL_CURRENT_USER_KEY);
    if (saved) {
      try {
        const u = JSON.parse(saved);
        if (u && (u.email?.toLowerCase() === 'admin@antem.org' || u.email?.toLowerCase() === 'rmo84791@gmail.com')) {
          u.role = 'admin';
        }
        return u;
      } catch (e) {}
    }
    // GATED ACCESS: No automatic login on first visit!
    return null;
  });

  const [allProgress, setAllProgress] = useState<Record<string, ActivityProgress>>({});
  const [allSubmissions, setAllSubmissions] = useState<AssignmentSubmission[]>(() => {
    const saved = localStorage.getItem(LOCAL_SUBMISSIONS_KEY);
    if (saved) {
      try { return JSON.parse(saved); } catch (e) {}
    }
    return [];
  });

  // Listen for Supabase session / email confirmation tokens in URL (#access_token=...)
  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase) return;

    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
      if ((event === 'SIGNED_IN' || event === 'USER_UPDATED' || event === 'TOKEN_REFRESHED') && session?.user) {
        const user = session.user;
        const cleanEmail = (user.email || '').toLowerCase();

        let resolvedRole: UserRole = 'student';
        let resolvedName = user.user_metadata?.name || user.email?.split('@')[0] || 'Utilizator';

        try {
          const { data: profileRow } = await supabase
            .from('profiles')
            .select('role, name')
            .eq('id', user.id)
            .maybeSingle();

          if (profileRow?.role) {
            resolvedRole = profileRow.role as UserRole;
          } else if (cleanEmail === 'admin@antem.org' || cleanEmail === 'rmo84791@gmail.com') {
            resolvedRole = 'admin';
          }

          if (profileRow?.name) {
            resolvedName = profileRow.name;
          }
        } catch (e) {}

        const profile: UserProfile = {
          id: user.id,
          email: cleanEmail,
          name: resolvedName,
          role: resolvedRole
        };

        setCurrentUser(profile);
        localStorage.setItem(LOCAL_CURRENT_USER_KEY, JSON.stringify(profile));

        setUsersList(prev => {
          const filtered = prev.filter(u => u.email.toLowerCase() !== cleanEmail);
          const updated = [...filtered, profile];
          localStorage.setItem(LOCAL_USERS_KEY, JSON.stringify(updated));
          return updated;
        });

        // Clean access_token from URL hash if present
        if (window.location.hash.includes('access_token')) {
          const cleanUrl = window.location.pathname + window.location.search;
          window.history.replaceState(null, '', cleanUrl);
        }
      }
    });

    return () => {
      authListener?.subscription.unsubscribe();
    };
  }, []);

  // Load progress when user changes
  useEffect(() => {
    if (!currentUser) {
      setAllProgress({});
      return;
    }

    // 1. Immediately load cached progress from localStorage for instant display
    const userProgressKey = `romanian_progress_${currentUser.id}`;
    const saved = localStorage.getItem(userProgressKey);
    if (saved) {
      try {
        setAllProgress(JSON.parse(saved));
      } catch (e) {
        setAllProgress({});
      }
    } else {
      setAllProgress({});
    }

    // 2. Fetch latest progress from Supabase
    const supabase = getSupabase();
    if (supabase) {
      // Sync profile to Supabase public.profiles
      supabase.from('profiles').upsert({
        id: currentUser.id,
        email: currentUser.email,
        name: currentUser.name,
        role: currentUser.role
      }, { onConflict: 'id' }).then(() => {});

      // Load from Supabase
      supabase
        .from('user_progress')
        .select('*')
        .eq('user_id', currentUser.id)
        .then(({ data, error }) => {
          if (!error && data) {
            const map: Record<string, ActivityProgress> = {};
            data.forEach((row: any) => {
              map[row.activity_id] = {
                activityId: row.activity_id,
                completed: row.completed,
                score: row.score,
                correctCount: row.correct_count,
                totalGaps: row.total_gaps,
                userAnswers: row.user_answers || {},
                lastAttemptAt: row.last_attempt_at
              };
            });
            setAllProgress(map);
            localStorage.setItem(userProgressKey, JSON.stringify(map));
          }
        });
    }
  }, [currentUser]);

  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [isPasswordRecoveryMode, setIsPasswordRecoveryMode] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return window.location.hash.includes('type=recovery');
    }
    return false;
  });

  // Sync users list from Supabase if currentUser is admin
  const refreshUsersList = async () => {
    const supabase = getSupabase();
    if (supabase) {
      try {
        const { data, error } = await supabase.from('profiles').select('*');
        if (!error && data && data.length > 0) {
          setUsersList(prev => {
            const map = new Map<string, UserProfile>();
            prev.forEach(u => map.set(u.email.toLowerCase(), u));
            data.forEach((p: any) => {
              const existing = map.get(p.email.toLowerCase());
              map.set(p.email.toLowerCase(), {
                id: p.id,
                email: p.email,
                name: p.name || p.email,
                role: (p.role as UserRole) || 'student',
                password: existing?.password || 'password123',
                createdAt: p.created_at
              });
            });
            const combined = Array.from(map.values());
            localStorage.setItem(LOCAL_USERS_KEY, JSON.stringify(combined));
            return combined;
          });
        }
      } catch (err) {
        console.warn('Failed to sync profiles from Supabase', err);
      }
    }
  };

  // Sync all local users to Supabase profiles
  const syncLocalUsersToSupabase = async (): Promise<{ count: number; error?: string }> => {
    const supabase = getSupabase();
    if (!supabase) return { count: 0, error: 'Supabase nu este configurat' };
    try {
      const records = usersList.map(u => ({
        id: u.id,
        email: u.email,
        name: u.name,
        role: u.role
      }));
      const { error } = await supabase.from('profiles').upsert(records, { onConflict: 'id' });
      if (error) return { count: 0, error: error.message };
      await refreshUsersList();
      return { count: records.length };
    } catch (e: any) {
      return { count: 0, error: e?.message || 'Eroare la sincronizare' };
    }
  };

  const currentUserRef = useRef<UserProfile | null>(currentUser);
  useEffect(() => {
    currentUserRef.current = currentUser;
  }, [currentUser]);

  // MASTER SYNC: Queries Supabase for latest progress, submissions, and profiles on every load/refresh
  const syncAllFromDatabase = useCallback(async () => {
    const supabase = getSupabase();
    if (!supabase) return;

    setIsSyncing(true);
    try {
      const activeUser = currentUserRef.current;

      // Parallel fetch from Supabase
      const [subsRes, progRes, profileRes] = await Promise.all([
        supabase
          .from('submissions')
          .select('*')
          .order('created_at', { ascending: false }),
        activeUser
          ? supabase.from('user_progress').select('*').eq('user_id', activeUser.id)
          : Promise.resolve(null),
        activeUser
          ? supabase.from('profiles').select('*').eq('id', activeUser.id).maybeSingle()
          : Promise.resolve(null)
      ]);

      // Apply latest submissions
      if (!subsRes.error && subsRes.data) {
        const mapped: AssignmentSubmission[] = subsRes.data.map((row: any) => ({
          id: row.id,
          userId: row.user_id,
          userEmail: row.user_email,
          userName: row.user_name,
          activityId: row.activity_id,
          activityTitle: row.activity_title,
          submissionText: row.submission_text,
          status: (row.status as 'pending' | 'reviewed') || 'pending',
          grade: row.grade !== null && row.grade !== undefined ? Number(row.grade) : undefined,
          teacherFeedback: row.teacher_feedback || undefined,
          createdAt: row.created_at
        }));
        setAllSubmissions(mapped);
        localStorage.setItem(LOCAL_SUBMISSIONS_KEY, JSON.stringify(mapped));
      }

      // Apply latest user progress
      if (activeUser && progRes && !progRes.error && progRes.data) {
        const map: Record<string, ActivityProgress> = {};
        progRes.data.forEach((row: any) => {
          map[row.activity_id] = {
            activityId: row.activity_id,
            completed: row.completed,
            score: row.score,
            correctCount: row.correct_count,
            totalGaps: row.total_gaps,
            userAnswers: row.user_answers || {},
            lastAttemptAt: row.last_attempt_at
          };
        });
        setAllProgress(map);
        const userProgressKey = `romanian_progress_${activeUser.id}`;
        localStorage.setItem(userProgressKey, JSON.stringify(map));
      }

      // Apply latest profile & role
      if (activeUser && profileRes && !profileRes.error && profileRes.data) {
        const p = profileRes.data;
        const cleanEmail = activeUser.email.toLowerCase();
        const isAdminEmail = cleanEmail === 'admin@antem.org' || cleanEmail === 'rmo84791@gmail.com';
        const freshRole: UserRole = isAdminEmail ? 'admin' : ((p.role as UserRole) || activeUser.role);

        if (p.name !== activeUser.name || freshRole !== activeUser.role) {
          const updatedProfile: UserProfile = {
            ...activeUser,
            name: p.name || activeUser.name,
            role: freshRole
          };
          setCurrentUser(updatedProfile);
          currentUserRef.current = updatedProfile;
          localStorage.setItem(LOCAL_CURRENT_USER_KEY, JSON.stringify(updatedProfile));
        }
      }

      // If admin, also refresh users list
      if (activeUser?.role === 'admin') {
        refreshUsersList();
      }

      setLastSyncedAt(new Date().toISOString());
    } catch (err) {
      console.warn('Sync from cloud database error:', err);
    } finally {
      setIsSyncing(false);
    }
  }, []);

  // Sync immediately when user changes (login, logout, switch)
  useEffect(() => {
    syncAllFromDatabase();
  }, [currentUser, syncAllFromDatabase]);

  // Long-lived real-time subscriptions and window focus/interval polling (registered once)
  useEffect(() => {
    const handleFocus = () => syncAllFromDatabase();
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        syncAllFromDatabase();
      }
    };
    const handleOnline = () => syncAllFromDatabase();

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('online', handleOnline);

    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        syncAllFromDatabase();
      }
    }, 20000);

    const supabase = getSupabase();
    let subsChannel: any = null;
    let progChannel: any = null;
    let authSub: any = null;

    if (supabase) {
      try {
        const { data } = supabase.auth.onAuthStateChange((event) => {
          if (event === 'PASSWORD_RECOVERY') {
            setIsPasswordRecoveryMode(true);
          }
        });
        authSub = data?.subscription;
      } catch (e) {
        // ignore
      }

      subsChannel = supabase
        .channel('submissions_realtime_sync')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'submissions' }, () => {
          syncAllFromDatabase();
        })
        .subscribe();

      progChannel = supabase
        .channel('progress_realtime_sync')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'user_progress' }, () => {
          syncAllFromDatabase();
        })
        .subscribe();
    }

    return () => {
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('online', handleOnline);
      clearInterval(interval);
      if (authSub && typeof authSub.unsubscribe === 'function') {
        authSub.unsubscribe();
      }
      if (supabase) {
        if (subsChannel) supabase.removeChannel(subsChannel);
        if (progChannel) supabase.removeChannel(progChannel);
      }
    };
  }, [syncAllFromDatabase]);

  const loginAs = (user: UserProfile) => {
    const isAdminEmail = user.email.toLowerCase() === 'admin@antem.org' || user.email.toLowerCase() === 'rmo84791@gmail.com';
    const resolvedUser: UserProfile = isAdminEmail ? { ...user, role: 'admin' } : user;
    setCurrentUser(resolvedUser);
    localStorage.setItem(LOCAL_CURRENT_USER_KEY, JSON.stringify(resolvedUser));

    const supabase = getSupabase();
    if (supabase) {
      supabase.from('profiles').upsert({
        id: resolvedUser.id,
        email: resolvedUser.email,
        name: resolvedUser.name,
        role: resolvedUser.role
      }).then(({ error }) => {
        if (error) console.warn('Profile sync notice:', error.message);
      });
    }
  };

  const loginWithCredentials = async (email: string, pass: string): Promise<{ success: boolean; error?: string }> => {
    const cleanEmail = email.trim().toLowerCase();
    const cleanPass = pass.trim();

    // Fast built-in credentials for demo or admin
    if (cleanEmail === 'demo@antem.org' && cleanPass === 'demo123') {
      loginAs(DEMO_USER);
      return { success: true };
    }
    if (cleanEmail === 'admin@antem.org' && cleanPass === 'admin123') {
      loginAs(INITIAL_DEMO_USERS[0]);
      return { success: true };
    }

    // 1. Check Supabase Auth if connected
    const supabase = getSupabase();
    if (supabase) {
      try {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password: cleanPass
        });
        if (!error && data.user) {
          let resolvedRole: UserRole = 'student';
          // Check profile table for actual role (admin / teacher / student)
          const { data: profileRow } = await supabase
            .from('profiles')
            .select('role, name')
            .eq('id', data.user.id)
            .single();

          if (profileRow?.role) {
            resolvedRole = profileRow.role as UserRole;
          } else if (cleanEmail === 'admin@antem.org' || cleanEmail === 'rmo84791@gmail.com') {
            resolvedRole = 'admin';
          } else if (data.user.user_metadata?.role) {
            resolvedRole = data.user.user_metadata.role as UserRole;
          }

          const profile: UserProfile = {
            id: data.user.id,
            email: data.user.email || cleanEmail,
            name: profileRow?.name || data.user.user_metadata?.name || data.user.email?.split('@')[0] || 'Utilizator',
            role: resolvedRole,
            password: cleanPass
          };

          // Save to local users list
          setUsersList(prev => {
            const filtered = prev.filter(u => u.email.toLowerCase() !== cleanEmail);
            const updated = [...filtered, profile];
            localStorage.setItem(LOCAL_USERS_KEY, JSON.stringify(updated));
            return updated;
          });

          loginAs(profile);
          return { success: true };
        }
      } catch (err) {
        console.warn('Supabase auth failed, falling back to local credentials', err);
      }
    }

    // 2. Check local users database
    const matched = usersList.find(u => u.email.toLowerCase() === cleanEmail);
    if (!matched) {
      return {
        success: false,
        error: 'Nu există niciun cont înregistrat cu acest e-mail. Vă rugăm să vă înregistrați.'
      };
    }

    if (matched.password && matched.password !== cleanPass) {
      return {
        success: false,
        error: 'Parolă incorectă. Vă rugăm să verificați datele introduse.'
      };
    }

    loginAs(matched);
    return { success: true };
  };

  const registerWithCredentials = async (
    name: string,
    email: string,
    pass: string
  ): Promise<{ success: boolean; error?: string }> => {
    const cleanEmail = email.trim().toLowerCase();
    const cleanName = name.trim();
    const cleanPass = pass.trim();
    // Recognize admin emails or default to student
    const isAdminEmail = cleanEmail === 'admin@antem.org' || cleanEmail === 'rmo84791@gmail.com';
    const role: UserRole = isAdminEmail ? 'admin' : 'student';

    if (!cleanName) return { success: false, error: 'Introduceți numele și prenumele.' };
    if (!cleanEmail || !cleanEmail.includes('@')) return { success: false, error: 'Introduceți o adresă de e-mail validă.' };
    if (cleanPass.length < 6) return { success: false, error: 'Parola trebuie să conțină cel puțin 6 caractere.' };

    let userId = `usr-${Date.now()}`;

    // Register in Supabase if connected
    const supabase = getSupabase();
    if (supabase) {
      try {
        const { data, error } = await supabase.auth.signUp({
          email: cleanEmail,
          password: cleanPass,
          options: {
            data: { name: cleanName, role: role }
          }
        });
        if (error) {
          return { success: false, error: `Supabase: ${error.message}` };
        }
        if (data.user) {
          userId = data.user.id;
          const { error: profileErr } = await supabase.from('profiles').upsert({
            id: userId,
            email: cleanEmail,
            name: cleanName,
            role: role
          });
          if (profileErr) {
            console.warn('Supabase profiles upsert warning:', profileErr.message);
          }
        }
      } catch (err: any) {
        return { success: false, error: err?.message || 'Eroare Supabase' };
      }
    } else {
      const existing = usersList.find(u => u.email.toLowerCase() === cleanEmail);
      if (existing) {
        return {
          success: false,
          error: 'Un cont cu această adresă de e-mail există deja. Autentificați-vă.'
        };
      }
    }

    const newUser: UserProfile = {
      id: userId,
      name: cleanName,
      email: cleanEmail,
      role: role,
      password: cleanPass,
      createdAt: new Date().toISOString()
    };

    const updated = [...usersList.filter(u => u.email.toLowerCase() !== cleanEmail), newUser];
    setUsersList(updated);
    localStorage.setItem(LOCAL_USERS_KEY, JSON.stringify(updated));
    loginAs(newUser);

    return { success: true };
  };

  const changeUserRole = async (userId: string, newRole: UserRole) => {
    const updated = usersList.map(u => {
      if (u.id === userId) {
        return { ...u, role: newRole };
      }
      return u;
    });
    setUsersList(updated);
    localStorage.setItem(LOCAL_USERS_KEY, JSON.stringify(updated));

    if (currentUser && currentUser.id === userId) {
      const updatedCurrent = { ...currentUser, role: newRole };
      setCurrentUser(updatedCurrent);
      localStorage.setItem(LOCAL_CURRENT_USER_KEY, JSON.stringify(updatedCurrent));
    }

    const supabase = getSupabase();
    if (supabase) {
      try {
        await supabase.from('profiles').update({ role: newRole }).eq('id', userId);
      } catch (err) {
        console.error('Supabase update role error', err);
      }
    }
  };

  const deleteUser = async (userId: string) => {
    const updated = usersList.filter(u => u.id !== userId);
    setUsersList(updated);
    localStorage.setItem(LOCAL_USERS_KEY, JSON.stringify(updated));

    const supabase = getSupabase();
    if (supabase) {
      try {
        await supabase.from('profiles').delete().eq('id', userId);
      } catch (err) {
        console.error('Supabase delete user error', err);
      }
    }
  };

  const createNewUser = (
    name: string,
    email: string,
    role: UserRole = 'student',
    password = 'password123'
  ): UserProfile => {
    const newUser: UserProfile = {
      id: `usr-${Date.now()}`,
      name: name.trim(),
      email: email.trim().toLowerCase(),
      role,
      password,
      createdAt: new Date().toISOString()
    };
    const updated = [...usersList, newUser];
    setUsersList(updated);
    localStorage.setItem(LOCAL_USERS_KEY, JSON.stringify(updated));
    return newUser;
  };

  const resetPasswordForEmail = async (email: string): Promise<{ success: boolean; message?: string; error?: string }> => {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      return { success: false, error: 'Introduceți o adresă de e-mail validă.' };
    }

    const supabase = getSupabase();
    if (supabase) {
      try {
        const redirectUrl = window.location.origin + window.location.pathname;
        const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
          redirectTo: redirectUrl
        });
        if (error) {
          return { success: false, error: error.message };
        }
        return {
          success: true,
          message: 'Linkul de resetare a parolei a fost trimis pe e-mail! Verificați căsuța poștală și folderul Spam.'
        };
      } catch (err: any) {
        return { success: false, error: err?.message || 'Eroare la trimiterea e-mailului' };
      }
    }

    const matched = usersList.find(u => u.email.toLowerCase() === cleanEmail);
    if (!matched) {
      return {
        success: false,
        error: 'Nu a fost găsit niciun cont cu această adresă de e-mail.'
      };
    }

    return {
      success: true,
      message: 'Cont găsit în mod local. Pentru conturile demo/locale parola este "password123" sau "demo123".'
    };
  };

  const updateUserPassword = async (newPassword: string): Promise<{ success: boolean; error?: string }> => {
    const cleanPass = newPassword.trim();
    if (cleanPass.length < 6) {
      return { success: false, error: 'Parola trebuie să conțină cel puțin 6 caractere.' };
    }

    const supabase = getSupabase();
    if (supabase) {
      try {
        const { error } = await supabase.auth.updateUser({
          password: cleanPass
        });
        if (error) {
          return { success: false, error: error.message };
        }
      } catch (err: any) {
        return { success: false, error: err?.message || 'Eroare la actualizarea parolei' };
      }
    }

    if (currentUser) {
      const updatedUser: UserProfile = { ...currentUser, password: cleanPass };
      setCurrentUser(updatedUser);
      currentUserRef.current = updatedUser;
      localStorage.setItem(LOCAL_CURRENT_USER_KEY, JSON.stringify(updatedUser));

      setUsersList(prev => {
        const updated = prev.map(u => (u.id === currentUser.id ? { ...u, password: cleanPass } : u));
        localStorage.setItem(LOCAL_USERS_KEY, JSON.stringify(updated));
        return updated;
      });
    }

    return { success: true };
  };

  const getStudentProgress = async (userId: string): Promise<Record<string, ActivityProgress>> => {
    if (currentUser && currentUser.id === userId && Object.keys(allProgress).length > 0) {
      return allProgress;
    }

    const supabase = getSupabase();
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('user_progress')
          .select('*')
          .eq('user_id', userId);
        if (!error && data && data.length > 0) {
          const map: Record<string, ActivityProgress> = {};
          data.forEach((row: any) => {
            map[row.activity_id] = {
              activityId: row.activity_id,
              completed: row.completed,
              score: row.score,
              correctCount: row.correct_count,
              totalGaps: row.total_gaps,
              userAnswers: row.user_answers || {},
              lastAttemptAt: row.last_attempt_at
            };
          });
          return map;
        }
      } catch (e) {
        console.warn('Failed to fetch student progress from Supabase:', e);
      }
    }

    // Local storage fallback
    try {
      const raw = localStorage.getItem(`romanian_progress_${userId}`);
      if (raw) return JSON.parse(raw);
    } catch {}

    return {};
  };

  const logout = () => {
    setCurrentUser(null);
    localStorage.removeItem(LOCAL_CURRENT_USER_KEY);
    const supabase = getSupabase();
    if (supabase) {
      supabase.auth.signOut().catch(() => {});
    }
  };

  const saveProgress = async (prog: ActivityProgress) => {
    if (!currentUser) return;

    // Update in state & localStorage immediately
    setAllProgress(prev => {
      const next = { ...prev, [prog.activityId]: prog };
      const userProgressKey = `romanian_progress_${currentUser.id}`;
      localStorage.setItem(userProgressKey, JSON.stringify(next));
      return next;
    });

    // Sync to Supabase with onConflict: 'user_id,activity_id'
    const supabase = getSupabase();
    if (supabase) {
      try {
        const { error } = await supabase.from('user_progress').upsert(
          {
            user_id: currentUser.id,
            activity_id: prog.activityId,
            completed: prog.completed,
            score: prog.score,
            correct_count: prog.correctCount,
            total_gaps: prog.totalGaps,
            user_answers: prog.userAnswers,
            last_attempt_at: prog.lastAttemptAt
          },
          { onConflict: 'user_id,activity_id' }
        );
        if (error) {
          console.error('Supabase save progress error:', error.message);
        }
      } catch (e) {
        console.error('Supabase save error', e);
      }
    }
  };

  const submitAssignment = async (activityId: string, activityTitle: string, text: string, aiEvaluation?: AIEvaluationResult) => {
    if (!currentUser) return;
    const submission: AssignmentSubmission = {
      id: `sub-${Date.now()}`,
      userId: currentUser.id,
      userEmail: currentUser.email,
      userName: currentUser.name,
      activityId,
      activityTitle,
      submissionText: text,
      status: aiEvaluation ? 'reviewed' : 'pending',
      grade: aiEvaluation ? aiEvaluation.grade : undefined,
      teacherFeedback: aiEvaluation ? aiEvaluation.summary : undefined,
      aiEvaluation,
      createdAt: new Date().toISOString()
    };

    setAllSubmissions(prev => {
      const updated = [submission, ...prev];
      localStorage.setItem(LOCAL_SUBMISSIONS_KEY, JSON.stringify(updated));
      return updated;
    });

    const supabase = getSupabase();
    if (supabase) {
      try {
        await supabase.from('submissions').insert({
          id: submission.id,
          user_id: submission.userId,
          user_email: submission.userEmail,
          user_name: submission.userName,
          activity_id: submission.activityId,
          activity_title: submission.activityTitle,
          submission_text: submission.submissionText,
          status: submission.status,
          grade: submission.grade ?? null,
          teacher_feedback: submission.teacherFeedback ?? null,
          created_at: submission.createdAt
        });
        await syncAllFromDatabase();
      } catch (e) {
        console.error('Supabase submit error', e);
      }
    }

    // Notify teacher via Telegram Bot (if configured)
    notifyNewSubmission({
      userName: submission.userName,
      userEmail: submission.userEmail,
      activityTitle: submission.activityTitle,
      submissionText: submission.submissionText
    }).catch(err => console.warn('Telegram notification notice:', err));
  };

  const reviewSubmission = async (submissionId: string, grade: number, feedback: string) => {
    const targetSub = allSubmissions.find(s => s.id === submissionId);
    if (targetSub) {
      notifyReviewedSubmission({
        userName: targetSub.userName,
        userEmail: targetSub.userEmail,
        activityTitle: targetSub.activityTitle,
        grade,
        feedback
      }).catch(err => console.warn('Telegram review notice:', err));
    }

    setAllSubmissions(prev => {
      const updated = prev.map(s => {
        if (s.id === submissionId) {
          return {
            ...s,
            status: 'reviewed' as const,
            grade,
            teacherFeedback: feedback
          };
        }
        return s;
      });
      localStorage.setItem(LOCAL_SUBMISSIONS_KEY, JSON.stringify(updated));
      return updated;
    });

    const supabase = getSupabase();
    if (supabase) {
      try {
        await supabase
          .from('submissions')
          .update({
            status: 'reviewed',
            grade,
            teacher_feedback: feedback
          })
          .eq('id', submissionId);
        await syncAllFromDatabase();
      } catch (e) {
        console.error('Supabase review error', e);
      }
    }
  };

  const deleteSubmission = async (submissionId: string) => {
    setAllSubmissions(prev => {
      const updated = prev.filter(s => s.id !== submissionId);
      localStorage.setItem(LOCAL_SUBMISSIONS_KEY, JSON.stringify(updated));
      return updated;
    });

    const supabase = getSupabase();
    if (supabase) {
      try {
        await supabase
          .from('submissions')
          .delete()
          .eq('id', submissionId);
        await syncAllFromDatabase();
      } catch (e) {
        console.error('Supabase delete submission error', e);
      }
    }
  };

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        usersList,
        allProgress,
        allSubmissions,
        loginAs,
        loginWithCredentials,
        registerWithCredentials,
        createNewUser,
        changeUserRole,
        deleteUser,
        resetPasswordForEmail,
        updateUserPassword,
        getStudentProgress,
        isPasswordRecoveryMode,
        setIsPasswordRecoveryMode,
        refreshUsersList,
        refreshSubmissions: syncAllFromDatabase,
        syncAllFromDatabase,
        isSyncing,
        lastSyncedAt,
        syncLocalUsersToSupabase,
        logout,
        saveProgress,
        submitAssignment,
        reviewSubmission,
        deleteSubmission
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
