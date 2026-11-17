import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
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
  syncAllFromDatabase: (options?: { force?: boolean }) => Promise<void>;
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

  // 1. Synchronously load cached progress from localStorage when active user changes
  useEffect(() => {
    if (!currentUser) {
      setAllProgress({});
      return;
    }
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
  }, [currentUser?.id]);

  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [isPasswordRecoveryMode, setIsPasswordRecoveryMode] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return window.location.hash.includes('type=recovery');
    }
    return false;
  });

  // Keep fresh refs to avoid stale closures in stable callbacks
  const currentUserRef = useRef<UserProfile | null>(currentUser);
  useEffect(() => {
    currentUserRef.current = currentUser;
  }, [currentUser]);

  const allProgressRef = useRef<Record<string, ActivityProgress>>(allProgress);
  useEffect(() => {
    allProgressRef.current = allProgress;
  }, [allProgress]);

  const usersListRef = useRef<UserProfile[]>(usersList);
  useEffect(() => {
    usersListRef.current = usersList;
  }, [usersList]);

  const allSubmissionsRef = useRef<AssignmentSubmission[]>(allSubmissions);
  useEffect(() => {
    allSubmissionsRef.current = allSubmissions;
  }, [allSubmissions]);

  // Client-side TTL cache for student dossiers (60s TTL)
  const studentProgressCacheRef = useRef<Map<string, { data: Record<string, ActivityProgress>; timestamp: number }>>(new Map());

  // In-flight mutex & throttling refs
  const inFlightSyncRef = useRef<Promise<void> | null>(null);
  const lastSyncTimestampRef = useRef<number>(0);

  // Sync users list from Supabase if currentUser is admin
  const refreshUsersList = useCallback(async () => {
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
  }, []);

  // Sync all local users to Supabase profiles
  const syncLocalUsersToSupabase = useCallback(async (): Promise<{ count: number; error?: string }> => {
    const supabase = getSupabase();
    if (!supabase) return { count: 0, error: 'Supabase nu este configurat' };
    try {
      const records = usersListRef.current.map(u => ({
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
  }, [refreshUsersList]);

  // MASTER SYNC: Deduplicated, throttled queries to Supabase
  const syncAllFromDatabase = useCallback(async (options?: { force?: boolean }): Promise<void> => {
    const supabase = getSupabase();
    if (!supabase) return;

    // SECURITY: Unauthenticated visitors must NEVER query submissions or user_progress
    const activeUser = currentUserRef.current;
    if (!activeUser) {
      return;
    }

    const now = Date.now();
    // Throttle: don't sync if another sync finished less than 5 seconds ago (unless forced)
    if (!options?.force && now - lastSyncTimestampRef.current < 5000) {
      return;
    }

    // In-flight deduplication: return active promise if already syncing
    if (inFlightSyncRef.current) {
      return inFlightSyncRef.current;
    }

    const runSync = async () => {
      setIsSyncing(true);
      try {
        const isStaff = activeUser.role === 'teacher' || 
                        activeUser.role === 'admin' || 
                        activeUser.email.toLowerCase() === 'admin@antem.org' || 
                        activeUser.email.toLowerCase() === 'rmo84791@gmail.com';
        const isAdmin = activeUser.role === 'admin' || 
                        activeUser.email.toLowerCase() === 'admin@antem.org' || 
                        activeUser.email.toLowerCase() === 'rmo84791@gmail.com';

        // 1 consolidated batch:
        // - submissions (Staff sees all for review, Student sees ONLY their own submissions)
        // - user_progress (only for active user)
        // - profiles (if admin: select('*') satisfies BOTH usersList and activeUser profile in 1 query!)
        const [subsRes, progRes, profilesRes] = await Promise.all([
          isStaff
            ? supabase.from('submissions').select('*').order('created_at', { ascending: false })
            : supabase.from('submissions').select('*').eq('user_id', activeUser.id).order('created_at', { ascending: false }),
          supabase.from('user_progress').select('*').eq('user_id', activeUser.id),
          isAdmin
            ? supabase.from('profiles').select('*')
            : supabase.from('profiles').select('*').eq('id', activeUser.id).maybeSingle()
        ]);

        // 1. Submissions
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

        // 2. User Progress
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

        // 3. Profiles
        if (isAdmin && profilesRes && !profilesRes.error && profilesRes.data) {
          const profileRows = profilesRes.data;
          setUsersList(prev => {
            const map = new Map<string, UserProfile>();
            prev.forEach(u => map.set(u.email.toLowerCase(), u));
            profileRows.forEach((p: any) => {
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

          if (activeUser) {
            const myRow = profileRows.find((p: any) => p.id === activeUser.id);
            if (myRow && (myRow.name !== activeUser.name || (myRow.role && myRow.role !== activeUser.role))) {
              const cleanEmail = activeUser.email.toLowerCase();
              const isAdminEmail = cleanEmail === 'admin@antem.org' || cleanEmail === 'rmo84791@gmail.com';
              const freshRole: UserRole = isAdminEmail ? 'admin' : ((myRow.role as UserRole) || activeUser.role);
              const updatedProfile: UserProfile = {
                ...activeUser,
                name: myRow.name || activeUser.name,
                role: freshRole
              };
              setCurrentUser(updatedProfile);
              currentUserRef.current = updatedProfile;
              localStorage.setItem(LOCAL_CURRENT_USER_KEY, JSON.stringify(updatedProfile));
            }
          }
        } else if (activeUser && profilesRes && !profilesRes.error && profilesRes.data) {
          const p = profilesRes.data;
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

        lastSyncTimestampRef.current = Date.now();
        setLastSyncedAt(new Date().toISOString());
      } catch (err) {
        console.warn('Sync from cloud database error:', err);
      } finally {
        setIsSyncing(false);
        inFlightSyncRef.current = null;
      }
    };

    inFlightSyncRef.current = runSync();
    return inFlightSyncRef.current;
  }, []);

  // Sync immediately when active user changes
  useEffect(() => {
    if (currentUser) {
      syncAllFromDatabase({ force: true });
    }
  }, [currentUser?.id, syncAllFromDatabase]);

  // Long-lived real-time subscriptions and window focus/interval polling
  useEffect(() => {
    // When returning to tab or window focus, only sync if logged in and it has been at least 30 seconds
    const handleFocusOrVisible = () => {
      if (!currentUserRef.current) return;
      if (document.visibilityState === 'visible') {
        const timeSinceLastSync = Date.now() - lastSyncTimestampRef.current;
        if (timeSinceLastSync > 30000) {
          syncAllFromDatabase();
        }
      }
    };

    window.addEventListener('focus', handleFocusOrVisible);
    document.addEventListener('visibilitychange', handleFocusOrVisible);
    window.addEventListener('online', handleFocusOrVisible);

    // Light background sync interval: 120 seconds (2 minutes), only when user is logged in
    const interval = setInterval(() => {
      if (!currentUserRef.current) return;
      if (document.visibilityState === 'visible') {
        const timeSinceLastSync = Date.now() - lastSyncTimestampRef.current;
        if (timeSinceLastSync > 60000) {
          syncAllFromDatabase();
        }
      }
    }, 120000);

    const supabase = getSupabase();
    let subsChannel: any = null;
    let progChannel: any = null;
    let authSub: any = null;
    let realtimeDebounceTimer: any = null;

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

      // Only establish realtime channels if an authenticated user is active
      if (currentUser) {
        // Debounced sync function for realtime events (collapses multiple rapid events into 1 sync)
        const triggerDebouncedSync = () => {
          if (realtimeDebounceTimer) clearTimeout(realtimeDebounceTimer);
          realtimeDebounceTimer = setTimeout(() => {
            syncAllFromDatabase({ force: true });
          }, 1500);
        };

        subsChannel = supabase
          .channel(`submissions_realtime_${currentUser.id}`)
          .on('postgres_changes', { event: '*', schema: 'public', table: 'submissions' }, () => {
            triggerDebouncedSync();
          })
          .subscribe();

        progChannel = supabase
          .channel(`progress_realtime_${currentUser.id}`)
          .on('postgres_changes', { event: '*', schema: 'public', table: 'user_progress' }, (payload: any) => {
            const activeUser = currentUserRef.current;
            const payloadUserId = payload?.new?.user_id || payload?.old?.user_id;

            // If another student changed their progress:
            // Invalidate their cached student card entry, but DO NOT re-query the entire database for this client!
            if (activeUser && payloadUserId && payloadUserId !== activeUser.id) {
              studentProgressCacheRef.current.delete(payloadUserId);
              return;
            }

            // If it's the active user: debounce sync
            triggerDebouncedSync();
          })
          .subscribe();
      }
    }

    return () => {
      window.removeEventListener('focus', handleFocusOrVisible);
      document.removeEventListener('visibilitychange', handleFocusOrVisible);
      window.removeEventListener('online', handleFocusOrVisible);
      clearInterval(interval);
      if (realtimeDebounceTimer) clearTimeout(realtimeDebounceTimer);
      if (authSub && typeof authSub.unsubscribe === 'function') {
        authSub.unsubscribe();
      }
      if (supabase) {
        if (subsChannel) supabase.removeChannel(subsChannel);
        if (progChannel) supabase.removeChannel(progChannel);
      }
    };
  }, [currentUser?.id, syncAllFromDatabase]);

  const loginAs = useCallback((user: UserProfile) => {
    const isAdminEmail = user.email.toLowerCase() === 'admin@antem.org' || user.email.toLowerCase() === 'rmo84791@gmail.com';
    const resolvedUser: UserProfile = isAdminEmail ? { ...user, role: 'admin' } : user;
    setCurrentUser(resolvedUser);
    currentUserRef.current = resolvedUser;
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
  }, []);

  const loginWithCredentials = useCallback(async (email: string, pass: string): Promise<{ success: boolean; error?: string }> => {
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
    const matched = usersListRef.current.find(u => u.email.toLowerCase() === cleanEmail);
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
  }, [loginAs]);

  const registerWithCredentials = useCallback(async (
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
      const existing = usersListRef.current.find(u => u.email.toLowerCase() === cleanEmail);
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

    setUsersList(prev => {
      const updated = [...prev.filter(u => u.email.toLowerCase() !== cleanEmail), newUser];
      localStorage.setItem(LOCAL_USERS_KEY, JSON.stringify(updated));
      return updated;
    });
    loginAs(newUser);

    return { success: true };
  }, [loginAs]);

  const changeUserRole = useCallback(async (userId: string, newRole: UserRole) => {
    setUsersList(prev => {
      const updated = prev.map(u => (u.id === userId ? { ...u, role: newRole } : u));
      localStorage.setItem(LOCAL_USERS_KEY, JSON.stringify(updated));
      return updated;
    });

    const active = currentUserRef.current;
    if (active && active.id === userId) {
      const updatedCurrent: UserProfile = { ...active, role: newRole };
      setCurrentUser(updatedCurrent);
      currentUserRef.current = updatedCurrent;
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
  }, []);

  const deleteUser = useCallback(async (userId: string) => {
    setUsersList(prev => {
      const updated = prev.filter(u => u.id !== userId);
      localStorage.setItem(LOCAL_USERS_KEY, JSON.stringify(updated));
      return updated;
    });

    const supabase = getSupabase();
    if (supabase) {
      try {
        await supabase.from('profiles').delete().eq('id', userId);
      } catch (err) {
        console.error('Supabase delete user error', err);
      }
    }
  }, []);

  const createNewUser = useCallback((
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
    setUsersList(prev => {
      const updated = [...prev, newUser];
      localStorage.setItem(LOCAL_USERS_KEY, JSON.stringify(updated));
      return updated;
    });
    return newUser;
  }, []);

  const resetPasswordForEmail = useCallback(async (email: string): Promise<{ success: boolean; message?: string; error?: string }> => {
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

    const matched = usersListRef.current.find(u => u.email.toLowerCase() === cleanEmail);
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
  }, []);

  const updateUserPassword = useCallback(async (newPassword: string): Promise<{ success: boolean; error?: string }> => {
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

    const active = currentUserRef.current;
    if (active) {
      const updatedUser: UserProfile = { ...active, password: cleanPass };
      setCurrentUser(updatedUser);
      currentUserRef.current = updatedUser;
      localStorage.setItem(LOCAL_CURRENT_USER_KEY, JSON.stringify(updatedUser));

      setUsersList(prev => {
        const updated = prev.map(u => (u.id === active.id ? { ...u, password: cleanPass } : u));
        localStorage.setItem(LOCAL_USERS_KEY, JSON.stringify(updated));
        return updated;
      });
    }

    return { success: true };
  }, []);

  // Stable, cached student progress fetcher with 60s in-memory TTL
  const getStudentProgress = useCallback(async (userId: string): Promise<Record<string, ActivityProgress>> => {
    // 1. If requesting active current user and memory state is populated
    const active = currentUserRef.current;
    if (active && active.id === userId && Object.keys(allProgressRef.current).length > 0) {
      return allProgressRef.current;
    }

    // 2. Check in-memory cache (60s TTL)
    const cached = studentProgressCacheRef.current.get(userId);
    const now = Date.now();
    if (cached && (now - cached.timestamp < 60000)) {
      return cached.data;
    }

    // 3. Query Supabase
    const supabase = getSupabase();
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('user_progress')
          .select('*')
          .eq('user_id', userId);
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
          studentProgressCacheRef.current.set(userId, { data: map, timestamp: now });
          return map;
        }
      } catch (e) {
        console.warn('Failed to fetch student progress from Supabase:', e);
      }
    }

    // 4. Local storage fallback
    try {
      const raw = localStorage.getItem(`romanian_progress_${userId}`);
      if (raw) return JSON.parse(raw);
    } catch {}

    return cached ? cached.data : {};
  }, []);

  const logout = useCallback(() => {
    setCurrentUser(null);
    currentUserRef.current = null;
    setAllSubmissions([]);
    setAllProgress({});
    localStorage.removeItem(LOCAL_CURRENT_USER_KEY);
    const supabase = getSupabase();
    if (supabase) {
      supabase.auth.signOut().catch(() => {});
    }
  }, []);

  const saveProgress = useCallback(async (prog: ActivityProgress) => {
    const active = currentUserRef.current;
    if (!active) return;

    // Update state & localStorage immediately
    setAllProgress(prev => {
      const next = { ...prev, [prog.activityId]: prog };
      const userProgressKey = `romanian_progress_${active.id}`;
      localStorage.setItem(userProgressKey, JSON.stringify(next));
      return next;
    });

    // Invalidate student dossier cache for active user
    studentProgressCacheRef.current.delete(active.id);

    // Sync to Supabase with onConflict: 'user_id,activity_id'
    const supabase = getSupabase();
    if (supabase) {
      try {
        const { error } = await supabase.from('user_progress').upsert(
          {
            user_id: active.id,
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
  }, []);

  const submitAssignment = useCallback(async (activityId: string, activityTitle: string, text: string, aiEvaluation?: AIEvaluationResult) => {
    const active = currentUserRef.current;
    if (!active) return;
    const submission: AssignmentSubmission = {
      id: `sub-${Date.now()}`,
      userId: active.id,
      userEmail: active.email,
      userName: active.name,
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
        const insertPayload: Record<string, any> = {
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
        };

        const { error } = await supabase.from('submissions').insert(insertPayload);
        if (error) {
          // If the postgres column type is integer (code 22P02: invalid input syntax for type integer: "7.5"),
          // automatically retry with rounded integer so the database write succeeds seamlessly
          if (error.code === '22P02' && typeof submission.grade === 'number') {
            const retryRes = await supabase.from('submissions').insert({
              ...insertPayload,
              grade: Math.round(submission.grade)
            });
            if (retryRes.error) {
              console.error('Supabase submit retry error:', retryRes.error);
            }
          } else {
            console.error('Supabase submit error:', error);
          }
        }
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
  }, []);

  const reviewSubmission = useCallback(async (submissionId: string, grade: number, feedback: string) => {
    const targetSub = allSubmissionsRef.current.find(s => s.id === submissionId);
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
        const updatePayload: Record<string, any> = {
          status: 'reviewed',
          grade,
          teacher_feedback: feedback
        };

        const { error } = await supabase
          .from('submissions')
          .update(updatePayload)
          .eq('id', submissionId);

        if (error) {
          // If the postgres column type is integer (code 22P02: invalid input syntax for type integer: "7.5"),
          // automatically retry with rounded integer so the database write succeeds seamlessly
          if (error.code === '22P02' && typeof grade === 'number') {
            const roundedGrade = Math.round(grade);
            const retryRes = await supabase
              .from('submissions')
              .update({
                ...updatePayload,
                grade: roundedGrade
              })
              .eq('id', submissionId);

            if (retryRes.error) {
              console.error('Supabase review retry error:', retryRes.error);
            }
          } else {
            console.error('Supabase review error:', error);
          }
        }
      } catch (e) {
        console.error('Supabase review error', e);
      }
    }
  }, []);

  const deleteSubmission = useCallback(async (submissionId: string) => {
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
      } catch (e) {
        console.error('Supabase delete submission error', e);
      }
    }
  }, []);

  const contextValue = useMemo<AuthContextType>(() => ({
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
  }), [
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
    refreshUsersList,
    syncAllFromDatabase,
    isSyncing,
    lastSyncedAt,
    syncLocalUsersToSupabase,
    logout,
    saveProgress,
    submitAssignment,
    reviewSubmission,
    deleteSubmission
  ]);

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
