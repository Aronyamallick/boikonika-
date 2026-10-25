import type { BookCardData } from './catalog';

/** Student Zone response shapes (mirror the API). */
export interface QuizCard {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  subject: string;
  academicLevel: string;
  language: string;
  timeLimitSeconds: number | null;
  passPercent: number;
  attemptCount: number;
  questionCount: number;
  best: number | null;
  passed: boolean;
}

export interface QuizDetail extends QuizCard {
  questions: Array<{ id: string; prompt: string; options: string[] }>;
  myAttempts: Array<{ score: number; passed: boolean; completedAt: string }>;
}

export interface QuizResult {
  scorePercent: number;
  correctCount: number;
  total: number;
  passed: boolean;
  late: boolean;
  passPercent: number;
  firstPass: boolean;
  results: Array<{ questionId: string; chosen: number; correctIndex: number; correct: boolean; explanation: string | null }>;
}

export interface EducationEvent {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  audience: string;
  startsAt: string;
  endsAt: string | null;
  location: string | null;
  onlineUrl: string | null;
  organizer: string | null;
  coverUrl: string | null;
}

export interface Competition {
  id: string;
  slug: string;
  title: string;
  kind: string;
  rules: string;
  prizes: string | null;
  audience: string;
  startsAt: string;
  endsAt: string;
  status: 'draft' | 'open' | 'judging' | 'closed';
  entryCount: number;
}

export interface Scholarship {
  id: string;
  slug: string;
  title: string;
  provider: string;
  description: string;
  eligibility: string | null;
  amountText: string | null;
  academicLevel: string | null;
  deadline: string | null;
  applyUrl: string | null;
}

export interface StudentHome {
  quizzes: QuizCard[];
  events: EducationEvent[];
  competitions: Competition[];
  scholarships: Scholarship[];
  studyGroups: Array<{ slug: string; name: string; subject: string | null; memberCount: number; institutionName: string | null }>;
  textbooks: BookCardData[];
}

export interface StudyNote {
  id: string;
  title: string;
  body: string;
  subject: string | null;
  page: number | null;
  visibility: 'public' | 'followers' | 'private';
  book: { title: string; slug: string } | null;
  updatedAt: string;
}
