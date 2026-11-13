export interface Gap {
  gapIndex: number;
  correctAnswers: string[];
}

export interface QuizOption {
  ansIdx: number;
  text: string;
  isCorrect: boolean;
}

export interface QuizQuestion {
  id: number;
  question: string;
  options: QuizOption[];
}

export interface MatchingPair {
  id: number;
  prompt: string;
  correctAnswer: string;
}

export interface AudioTrack {
  id: string;
  title: string;
  category: string;
  audioUrl: string;
}

export interface Activity {
  id: string;
  title: string;
  instructions?: string;
  readingHtml?: string;
  bodyHtml?: string;
  media?: string[];
  type: string;
  gaps?: Gap[];
  orderItems?: string[];
  quizQuestions?: QuizQuestion[];
  matchingPairs?: MatchingPair[];
  audioTracks?: AudioTrack[];
  audioFiles?: string[];
  url?: string;
}

export interface Section {
  sectionId: string;
  title: string;
  activities: Activity[];
}

export interface CourseData {
  courseId: number;
  courseTitle: string;
  extractedAt: string;
  totalSections: number;
  sections: Section[];
}

export interface ActivityProgress {
  activityId: string;
  completed: boolean;
  score: number; // percentage (0-100)
  correctCount: number;
  totalGaps: number;
  userAnswers: Record<number, string>;
  lastAttemptAt: string;
}

export interface AICorrection {
  original: string;
  corrected: string;
  explanation: string;
}

export interface AIEvaluationResult {
  grade: number;
  summary: string;
  strengths: string[];
  corrections: AICorrection[];
  improvedText: string;
  recommendation: string;
}

export interface AssignmentSubmission {
  id: string;
  userId: string;
  userEmail: string;
  userName: string;
  activityId: string;
  activityTitle: string;
  submissionText: string;
  status: 'pending' | 'reviewed';
  teacherFeedback?: string;
  grade?: number;
  aiEvaluation?: AIEvaluationResult;
  createdAt: string;
}

export interface UserStats {
  totalActivities: number;
  completedActivities: number;
  averageScore: number;
  totalGapsCompleted: number;
}
