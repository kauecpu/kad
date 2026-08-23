import type {
  AlternativeId,
  BillingCycle,
  Concurso,
  ConcursoPack,
  Discipline,
  EssayDocument,
  Question,
  Subscription,
  ThemePreference,
} from '@/types';
import type { EssayTopic } from '@/data/essay-topics';
import type { RankingParticipantSeed } from '@/data/ranking';

export type {
  AlternativeId,
  BillingCycle,
  Concurso,
  ConcursoPack,
  Discipline,
  EssayDocument,
  Question,
  Subscription,
  ThemePreference,
  EssayTopic,
  RankingParticipantSeed,
};

export type AuthMode = 'visitor' | 'authenticated';

export type SiteAnswer = {
  questionId: string;
  subject: string;
  selected: AlternativeId;
  isCorrect: boolean;
  answeredAt: string;
};

export type SiteComment = {
  id: string;
  author: string;
  text: string;
  createdAt: string;
};

export type SiteFeedback = {
  id: string;
  kind: string;
  message: string;
  source: string;
  created_at: string;
  synced: boolean;
};

export type SiteSimulationConfig = {
  packId: string;
  discipline: string;
  board: string;
  difficulty: string;
  questionCount: number;
  durationMinutes: number;
  shuffleQuestions: boolean;
};

export type SiteSimulationSession = {
  id: string;
  status: 'active' | 'paused' | 'completed';
  config: SiteSimulationConfig;
  questionIds: string[];
  answers: Record<string, AlternativeId>;
  currentIndex: number;
  remainingSeconds: number;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
};

export type SiteState = {
  version: 1;
  auth: { mode: AuthMode; userId: string | null };
  profile: {
    name: string;
    email: string;
    username: string;
    phone: string;
    city: string;
    targetRole: string;
  };
  preferences: {
    theme: ThemePreference;
    weeklyGoal: number;
    hasStarted: boolean;
  };
  subscription: Subscription;
  answers: Record<string, SiteAnswer>;
  favorites: string[];
  savedConcursos: string[];
  comments: Record<string, SiteComment[]>;
  simulations: { current: SiteSimulationSession | null; history: SiteSimulationSession[] };
  essays: Record<string, EssayDocument>;
  trail: unknown | null;
  feedback: SiteFeedback[];
  activityByDate: Record<string, string[]>;
};

export type SiteCatalog = {
  concursos: Concurso[];
  disciplines: Discipline[];
  essayTopics: EssayTopic[];
  packs: ConcursoPack[];
  questions: Question[];
  rankingParticipants: RankingParticipantSeed[];
};

export type Route = {
  pathname: string;
  search: string;
  params: Record<string, string>;
};

export type ViewModel = {
  title: string;
  content: string;
  subtitle?: string;
  description?: string;
  indexable?: boolean;
  layout?: 'public' | 'public-simple';
};

export type UiState = {
  questionIndex: number;
  visitedQuestionIds: Set<string>;
  lastRouteKey: string;
  essayBuffer: { topicId: string; content: string } | null;
  toastTimer: ReturnType<typeof setTimeout> | null;
  simulationTimer: ReturnType<typeof setInterval> | null;
  essayTimer: ReturnType<typeof setInterval> | null;
  checkoutId: string;
  recoveryStatus: 'idle' | 'checking' | 'ready' | 'invalid';
  checkoutTimer: ReturnType<typeof setTimeout> | null;
  authStoryIndex: number;
  authStoryTimer: ReturnType<typeof setInterval> | null;
  authStoryPaused: boolean;
  authStoryInteractionPaused: boolean;
};

export type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

export type Store = {
  getState(): SiteState;
  getOwnerId(): string | null;
  switchOwner(userId: string | null): SiteState;
  replace(next: unknown): SiteState;
  update(recipe: (draft: SiteState) => SiteState | void, options?: { silent?: boolean }): SiteState;
  subscribe(listener: (state: SiteState) => void): () => boolean;
  reset(): SiteState;
};
