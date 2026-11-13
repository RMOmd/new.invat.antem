import React, { createContext, useContext, useState, useEffect } from 'react';
import { getSupabase } from '../lib/supabase';
import { ActivityProgress, AssignmentSubmission } from '../types/course';

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  role: 'student' | 'teacher';
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
  registerWithCredentials: (name: string, email: string, password: string, role: 'student' | 'teacher') => Promise<{ success: boolean; error?: string }>;
  createNewUser: (name: string, email: string, role: 'student' | 'teacher', password?: string) => UserProfile;
  logout: () => void;
  saveProgress: (progress: ActivityProgress) => Promise<void>;
  submitAssignment: (activityId: string, activityTitle: string, text: string) => Promise<void>;
  reviewSubmission: (submissionId: string, grade: number, feedback: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const LOCAL_USERS_KEY = 'romanian_platform_users';
const LOCAL_CURRENT_USER_KEY = 'romanian_platform_current_user';
const LOCAL_SUBMISSIONS_KEY = 'romanian_platform_submissions';

const INITIAL_DEMO_USERS: UserProfile[] = [
  { id: 'usr-student-1', name: 'Danila Student', email: 'danila@example.com', role: 'student', password: 'password123', createdAt: '2026-01-01' },
  { id: 'usr-student-2', name: 'Elena Cojocaru', email: 'elena@example.com', role: 'student', password: 'password123', createdAt: '2026-01-01' },
  { id: 'usr-teacher', name: 'Profesor ANTEM', email: 'teacher@antem.org', role: 'teacher', password: 'password123', createdAt: '2026-01-01' }
];

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [usersList, setUsersList] = useState<UserProfile[]>(() => {
    const saved = localStorage.getItem(LOCAL_USERS_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          // Ensure every user has a default password if missing
          return parsed.map(u => ({ ...u, password: u.password || 'password123' }));
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

  const loginAs = (user: UserProfile) => {
    setCurrentUser(user);
    localStorage.setItem(LOCAL_CURRENT_USER_KEY, JSON.stringify(user));
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
          const profile: UserProfile = {
            id: data.user.id,
            email: data.user.email || cleanEmail,
            name: data.user.user_metadata?.name || data.user.email?.split('@')[0] || 'Utilizator',
            role: data.user.user_metadata?.role === 'teacher' ? 'teacher' : 'student',
            password: cleanPass
          };
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
    pass: string,
    role: 'student' | 'teacher'
  ): Promise<{ success: boolean; error?: string }> => {
    const cleanEmail = email.trim().toLowerCase();
    const cleanName = name.trim();
    const cleanPass = pass.trim();

    if (!cleanName) return { success: false, error: 'Introduceți numele și prenumele.' };
    if (!cleanEmail || !cleanEmail.includes('@')) return { success: false, error: 'Introduceți o adresă de e-mail validă.' };
    if (cleanPass.length < 6) return { success: false, error: 'Parola trebuie să conțină cel puțin 6 caractere.' };

    // Check if email is already registered locally
    const existing = usersList.find(u => u.email.toLowerCase() === cleanEmail);
    if (existing) {
      return {
        success: false,
        error: 'Un cont cu această adresă de e-mail există deja. Autentificați-vă.'
      };
    }

    let userId = `usr-${Date.now()}`;

    // Register in Supabase if connected
    const supabase = getSupabase();
    if (supabase) {
      try {
        const { data, error } = await supabase.auth.signUp({
          email: cleanEmail,
          password: cleanPass,
          options: {
            data: { name: cleanName, role }
          }
        });
        if (error) {
          console.warn('Supabase signup notice:', error.message);
        } else if (data.user) {
          userId = data.user.id;
        }
      } catch (err) {
        console.warn('Supabase signup error fallback:', err);
      }
    }

    const newUser: UserProfile = {
      id: userId,
      name: cleanName,
      email: cleanEmail,
      role,
      password: cleanPass,
      createdAt: new Date().toISOString()
    };

    const updated = [...usersList, newUser];
    setUsersList(updated);
    localStorage.setItem(LOCAL_USERS_KEY, JSON.stringify(updated));
    loginAs(newUser);

    return { success: true };
  };

  const createNewUser = (
    name: string,
    email: string,
    role: 'student' | 'teacher',
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
    loginAs(newUser);
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
