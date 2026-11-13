import React, { createContext, useContext, useState, useEffect } from 'react';
import { getSupabase } from '../lib/supabase';
import { ActivityProgress, AssignmentSubmission } from '../types/course';

export type UserRole = 'student' | 'teacher' | 'admin';

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
  refreshUsersList: () => Promise<void>;
  syncLocalUsersToSupabase: () => Promise<{ count: number; error?: string }>;
  logout: () => void;
  saveProgress: (progress: ActivityProgress) => Promise<void>;
  submitAssignment: (activityId: string, activityTitle: string, text: string) => Promise<void>;
  reviewSubmission: (submissionId: string, grade: number, feedback: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const LOCAL_USERS_KEY = 'romanian_platform_users';
const LOCAL_CURRENT_USER_KEY = 'romanian_platform_current_user';
const LOCAL_SUBMISSIONS_KEY = 'romanian_platform_submissions';

export const INITIAL_DEMO_USERS: UserProfile[] = [
  { id: 'usr-admin', name: 'Administrator', email: 'admin@antem.org', role: 'admin', password: 'admin123', createdAt: '2026-01-01' },
  { id: 'usr-teacher', name: 'Profesor ANTEM', email: 'teacher@antem.org', role: 'teacher', password: 'password123', createdAt: '2026-01-01' },
  { id: 'usr-student-1', name: 'Danila Student', email: 'danila@example.com', role: 'student', password: 'password123', createdAt: '2026-01-01' },
  { id: 'usr-student-2', name: 'Elena Cojocaru', email: 'elena@example.com', role: 'student', password: 'password123', createdAt: '2026-01-01' }
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
        return JSON.parse(saved);
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

  // Load progress when user changes
  useEffect(() => {
    if (!currentUser) {
      setAllProgress({});
      return;
    }

    const supabase = getSupabase();
    if (supabase) {
      // Sync profile to Supabase public.profiles
      supabase.from('profiles').upsert({
        id: currentUser.id,
        email: currentUser.email,
        name: currentUser.name,
        role: currentUser.role
      }).then(() => {});

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
          }
        });
    } else {
      // Load from localStorage isolated by user ID
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
    }
  }, [currentUser]);

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

  useEffect(() => {
    if (currentUser?.role === 'admin') {
      refreshUsersList();
    }
  }, [currentUser]);

  const loginAs = (user: UserProfile) => {
    setCurrentUser(user);
    localStorage.setItem(LOCAL_CURRENT_USER_KEY, JSON.stringify(user));

    const supabase = getSupabase();
    if (supabase) {
      supabase.from('profiles').upsert({
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role
      }).then(({ error }) => {
        if (error) console.warn('Profile sync notice:', error.message);
      });
    }
  };

  const loginWithCredentials = async (email: string, pass: string): Promise<{ success: boolean; error?: string }> => {
    const cleanEmail = email.trim().toLowerCase();
    const cleanPass = pass.trim();

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
          } else if (cleanEmail === 'admin@antem.org') {
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
    // Rule: Nobody can register as teacher or admin! Everyone registers as student!
    const role: UserRole = 'student';

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
            data: { name: cleanName, role: 'student' }
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
            role: 'student'
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
      role: 'student',
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

    // Sync to Supabase if connected
    const supabase = getSupabase();
    if (supabase) {
      try {
        await supabase.from('user_progress').upsert({
          user_id: currentUser.id,
          activity_id: prog.activityId,
          completed: prog.completed,
          score: prog.score,
          correct_count: prog.correctCount,
          total_gaps: prog.totalGaps,
          user_answers: prog.userAnswers,
          last_attempt_at: prog.lastAttemptAt
        });
      } catch (e) {
        console.error('Supabase save error', e);
      }
    }
  };

  const submitAssignment = async (activityId: string, activityTitle: string, text: string) => {
    if (!currentUser) return;
    const submission: AssignmentSubmission = {
      id: `sub-${Date.now()}`,
      userId: currentUser.id,
      userEmail: currentUser.email,
      userName: currentUser.name,
      activityId,
      activityTitle,
      submissionText: text,
      status: 'pending',
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
          created_at: submission.createdAt
        });
      } catch (e) {
        console.error('Supabase submit error', e);
      }
    }
  };

  const reviewSubmission = async (submissionId: string, grade: number, feedback: string) => {
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
      } catch (e) {
        console.error('Supabase review error', e);
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
        refreshUsersList,
        syncLocalUsersToSupabase,
        logout,
        saveProgress,
        submitAssignment,
        reviewSubmission
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
