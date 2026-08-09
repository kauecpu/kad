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

export type AlternativeId = 'A' | 'B' | 'C' | 'D' | 'E';

export type AdminQuestion = {
  id: string;
  discipline: string;
  subject: string;
  topic: string;
  board: string;
  year: number;
  role: string;
  institution: string;
  concurso: string;
  level: EducationLevel;
  statement: string;
  alternatives: { id: AlternativeId; text: string }[];
  correct: AlternativeId;
  explanation: string;
  difficulty: 'Fácil' | 'Média' | 'Difícil';
  publicationStatus: PublicationStatus;
  publishedAt?: string;
  sourceProvider?: string;
  sourceExternalId?: string;
  sourceUrl?: string;
  sourceCollectedAt?: string;
  importBatchId?: string;
  updatedAt: string;
};

export type EditorialImportKind = 'concurso' | 'question';
export type ImportBatchStatus = 'staging' | 'imported' | 'import_partial' | 'rolled_back' | 'rollback_partial';
export type ImportItemStatus = 'ready' | 'invalid' | 'duplicate' | 'imported' | 'skipped' | 'failed' | 'rolled_back' | 'rollback_blocked';
export type ImportDecision = 'import' | 'upsert' | 'skip';

export type EditorialImportRecord = {
  schemaVersion: 1;
  kind: EditorialImportKind;
  source: {
    provider: string;
    externalId: string;
    url: string;
    collectedAt: string;
  };
  data: Record<string, unknown> & { id: string };
};

export type AdminImportBatch = {
  id: string;
  filename: string;
  status: ImportBatchStatus;
  itemCount: number;
  readyCount: number;
  invalidCount: number;
  duplicateCount: number;
  createdAt: string;
  importedAt?: string;
  rolledBackAt?: string;
};

export type AdminImportItem = {
  id: string;
  position: number;
  kind?: EditorialImportKind;
  resourceId?: string;
  sourceKey?: string;
  status: ImportItemStatus;
  decision: ImportDecision;
  errors: string[];
  payload: EditorialImportRecord | Record<string, unknown>;
};

export type AdminImportBatchDetail = AdminImportBatch & { items: AdminImportItem[] };
