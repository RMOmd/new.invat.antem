import React, { createContext, useContext, useState, useEffect } from 'react';
import { getSupabase } from '../lib/supabase';
import { ActivityProgress, AssignmentSubmission } from '../types/course';

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  role: 'student' | 'teacher';
}

interface AuthContextType {
  currentUser: UserProfile | null;
  usersList: UserProfile[];
  allProgress: Record<string, ActivityProgress>;
  allSubmissions: AssignmentSubmission[];
  loginAs: (user: UserProfile) => void;
  createNewUser: (name: string, email: string, role: 'student' | 'teacher') => UserProfile;
  logout: () => void;
  saveProgress: (progress: ActivityProgress) => Promise<void>;
  submitAssignment: (activityId: string, activityTitle: string, text: string) => Promise<void>;
  reviewSubmission: (submissionId: string, grade: number, feedback: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const LOCAL_USERS_KEY = 'romanian_platform_users';
const LOCAL_CURRENT_USER_KEY = 'romanian_platform_current_user';
const LOCAL_SUBMISSIONS_KEY = 'romanian_platform_submissions';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [usersList, setUsersList] = useState<UserProfile[]>(() => {
    const saved = localStorage.getItem(LOCAL_USERS_KEY);
    if (saved) {
      try { return JSON.parse(saved); } catch (e) {}
    }
    // Default demo users (1 student, 1 teacher)
    const initial: UserProfile[] = [
      { id: 'usr-student-1', name: 'Student Danila', email: 'danila@example.com', role: 'student' },
      { id: 'usr-student-2', name: 'Student Elena', email: 'elena@example.com', role: 'student' },
      { id: 'usr-teacher', name: 'Profesor (Teacher)', email: 'teacher@antem.org', role: 'teacher' }
    ];
    localStorage.setItem(LOCAL_USERS_KEY, JSON.stringify(initial));
    return initial;
  });

  const [currentUser, setCurrentUser] = useState<UserProfile | null>(() => {
    const saved = localStorage.getItem(LOCAL_CURRENT_USER_KEY);
    if (saved) {
      try { return JSON.parse(saved); } catch (e) {}
    }
    return usersList[0] || null;
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

  const createNewUser = (name: string, email: string, role: 'student' | 'teacher'): UserProfile => {
    const newUser: UserProfile = {
      id: `usr-${Date.now()}`,
      name,
      email,
      role
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

