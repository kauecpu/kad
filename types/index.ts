/** Tipos de domínio compartilhados pelo aplicativo. */

export type AlternativeId = 'A' | 'B' | 'C' | 'D' | 'E';

export type Alternative = {
  id: AlternativeId;
  text: string;
};

export type Difficulty = 'Fácil' | 'Média' | 'Difícil';

export type EducationLevel = 'Fundamental' | 'Médio' | 'Superior';

/** Preferência de aparência escolhida pelo usuário. */
export type ThemePreference = 'system' | 'light' | 'dark';

/** Filtro de situação da questão na busca avançada. */
export type AnsweredFilter = 'all' | 'answered' | 'unanswered';
/** Filtro de desempenho na busca avançada. */
export type ResultFilter = 'all' | 'correct' | 'wrong';

/** Estado completo da tela "Procurar questões". */
export type QuestionSearch = {
  keyword: string;
  disciplines: string[];
  topics: string[];
  boards: string[];
  roles: string[];
  years: number[];
  difficulties: string[];
  institutions: string[];
  answered: AnsweredFilter;
  result: ResultFilter;
};

/**
 * Disciplina principal e seus assuntos de concurso.
 * Estrutura editável: novas disciplinas ou assuntos podem ser adicionados/removidos aqui.
 */
export type Discipline = {
  name: string;
  /** Nome do ícone (Ionicons) exibido na listagem. */
  icon: string;
  /** Cor do ícone da disciplina. */
  color: string;
  /** Assuntos cobrados em editais, na ordem em que aparecem. */
  topics: string[];
};

/**
 * Agrupamento de estudo por concurso ou área, limitado por órgão, edital ou cargo.
 * Estrutura editável.
 */
export type ConcursoPack = {
  id: string;
  /** Título curto, ex.: "Tribunais". */
  name: string;
  /** Informação secundária, ex.: "TJ, TRF e TRT". */
  subtitle?: string;
  icon: string;
  color: string;
  /** Distingue um concurso específico de um agrupamento temático. */
  kind: 'concurso' | 'area';
  /** Disciplinas (de `DISCIPLINES`) que compõem o pacote. */
  disciplines: string[];
  /**
   * Termos usados para limitar o pacote às questões realmente relacionadas ao concurso ou área.
   * Basta uma correspondência entre órgão, nome do concurso ou cargo.
   */
  questionScope: {
    institutions?: string[];
    concursos?: string[];
    roles?: string[];
  };
  /** Cargos do perfil para os quais este pacote é uma recomendação natural. */
  goalKeywords: string[];
};

export type Question = {
  id: string;
  /** Disciplina principal (nível 1), ex.: "Matemática", "Direito". */
  discipline: string;
  /** Matéria específica exibida no cartão, ex.: "Direito Penal". */
  subject: string;
  /** Assunto do concurso (nível 2), ex.: "Porcentagem". */
  topic: string;
  board: string;
  year: number;
  role: string;
  /** Órgão/instituição que promove o concurso. */
  institution: string;
  /** Nome do concurso ao qual a questão pertence. */
  concurso: string;
  level: EducationLevel;
  difficulty: Difficulty;
  statement: string;
  alternatives: Alternative[];
  correct: AlternativeId;
  /** Gabarito comentado exibido logo após a resposta. */
  explanation: string;
};

export type QuestionFilters = {
  subjects: string[];
  boards: string[];
  years: number[];
  roles: string[];
};

export type Region = 'Norte' | 'Nordeste' | 'Centro-Oeste' | 'Sudeste' | 'Sul' | 'Nacional';

export type ConcursoStatus = 'aberto' | 'previsto' | 'encerrado';

export type ConcursoRole = {
  name: string;
  vacancies: number;
  salary: number;
  level: EducationLevel;
};

export type Concurso = {
  id: string;
  /** Sigla exibida no selo do cartão, ex.: "TJ-SP". */
  shortName: string;
  /** Nome do ícone (Ionicons) que simboliza o órgão. */
  icon?: string;
  /** Cor do ícone/selo, geralmente aproximando a identidade visual do órgão. */
  iconColor?: string;
  organ: string;
  title: string;
  board: string;
  state: string;
  city?: string;
  region: Region;
  levels: EducationLevel[];
  vacancies: number;
  salaryMin: number;
  salaryMax: number;
  /** Datas em formato ISO (YYYY-MM-DD). Indefinidas quando o edital é apenas previsto. */
  registrationStart?: string;
  registrationEnd?: string;
  examDate?: string;
  fee?: number;
  status: ConcursoStatus;
  roles: ConcursoRole[];
  highlights: string[];
  /** Canal oficial do órgão com edital ou acompanhamento do concurso. */
  editalUrl: string;
  updatedAt: string;
  /** Origem editorial usada para diferenciar o acervo local da publicação administrativa. */
  contentSource?: 'demo' | 'published';
};

export type SubscriptionPlan = 'basic' | 'diamond' | 'circle';

export type BillingCycle = 'monthly' | 'quarterly' | 'annual';

export type Subscription = {
  plan: SubscriptionPlan;
  billingCycle?: BillingCycle;
  /** Estados intermediários preservam o acesso já pago até `renewsAt`. */
  status: 'active' | 'inactive' | 'past_due' | 'canceled' | 'expired';
  startedAt?: string;
  renewsAt?: string;
  autoRenew: boolean;
  provider?: 'mercado_pago' | 'apple' | 'google';
};

export type DailyQuestionUsage = {
  /** Data local no formato YYYY-MM-DD. */
  date: string;
  /** Questões únicas consumidas na cota diária. */
  questionIds: string[];
};

export type UserProfile = {
  name: string;
  email: string;
  /** Identificador público único escolhido no cadastro. */
  username?: string;
  avatarUri?: string;
  phone?: string;
  city?: string;
  targetRole?: string;
};

export type AnswerRecord = {
  questionId: string;
  subject: string;
  selected: AlternativeId;
  isCorrect: boolean;
  answeredAt: string;
};

export type SubjectPerformance = {
  subject: string;
  total: number;
  correct: number;
  accuracy: number;
};

export type Performance = {
  total: number;
  correct: number;
  wrong: number;
  accuracy: number;
  bySubject: SubjectPerformance[];
};

export type SimulationConfig = {
  packId?: string;
  disciplines: string[];
  topics: string[];
  boards: string[];
  years: number[];
  difficulties: Difficulty[];
  questionCount: number;
  durationMinutes: number;
  shuffleQuestions: boolean;
  shuffleAlternatives: boolean;
};

export type SimulationQuestion = {
  questionId: string;
  alternativeOrder: AlternativeId[];
};

export type SimulationSession = {
  id: string;
  status: 'active' | 'paused' | 'completed';
  config: SimulationConfig;
  questions: SimulationQuestion[];
  answers: Record<string, AlternativeId>;
  currentIndex: number;
  remainingSeconds: number;
  createdAt: string;
  completedAt?: string;
  /** Instante usado para resolver alterações feitas em aparelhos diferentes. */
  updatedAt?: string;
};

export type EssayDocument = {
  topicId: string;
  content: string;
  elapsedSeconds: number;
  status: 'draft' | 'submitted';
  submittedAt?: string;
  updatedAt: string;
};
