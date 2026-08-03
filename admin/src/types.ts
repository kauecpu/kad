export type AdminRole = 'owner' | 'admin' | 'editor' | 'moderator' | 'support';

export type AdminAccess = {
  role: AdminRole;
  permissions: string[];
};

export type DashboardSummary = {
  users_total: number;
  users_last_7_days: number;
  question_attempts_total: number;
  active_students_last_7_days: number;
  saved_concursos_total: number;
  comments_total: number;
  comments_last_7_days: number;
  generated_at: string;
};

export type EducationLevel = 'Fundamental' | 'Médio' | 'Superior';
export type ConcursoRegion =
  | 'Norte'
  | 'Nordeste'
  | 'Centro-Oeste'
  | 'Sudeste'
  | 'Sul'
  | 'Nacional';
export type ConcursoStatus = 'aberto' | 'previsto' | 'encerrado';
export type PublicationStatus = 'draft' | 'review' | 'published' | 'archived';

export type AdminConcursoRole = {
  name: string;
  vacancies: number;
  salary: number;
  level: EducationLevel;
};

export type AdminConcurso = {
  id: string;
  shortName: string;
  icon: string;
  iconColor: string;
  organ: string;
  title: string;
  board: string;
  state: string;
  city?: string;
  region: ConcursoRegion;
  levels: EducationLevel[];
  vacancies: number;
  salaryMin: number;
  salaryMax: number;
  registrationStart?: string;
  registrationEnd?: string;
  examDate?: string;
  fee?: number;
  status: ConcursoStatus;
  roles: AdminConcursoRole[];
  highlights: string[];
  editalUrl: string;
  publicationStatus: PublicationStatus;
  publishedAt?: string;
  updatedAt: string;
};
