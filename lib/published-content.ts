import type {
  Alternative,
  AlternativeId,
  Concurso,
  ConcursoRole,
  Difficulty,
  EducationLevel,
  Question,
  Region,
} from '@/types';

const ALTERNATIVE_IDS: AlternativeId[] = ['A', 'B', 'C', 'D', 'E'];
const EDUCATION_LEVELS: EducationLevel[] = ['Fundamental', 'Médio', 'Superior'];
const DIFFICULTIES: Difficulty[] = ['Fácil', 'Média', 'Difícil'];
const REGIONS: Region[] = [
  'Norte',
  'Nordeste',
  'Centro-Oeste',
  'Sudeste',
  'Sul',
  'Nacional',
];

type JsonObject = Record<string, unknown>;

function isObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function numberFrom(value: unknown): number | null {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function optionalString(value: unknown): string | undefined {
  return isNonEmptyString(value) ? value : undefined;
}

function stringArray(value: unknown): string[] | null {
  return Array.isArray(value) && value.every(isNonEmptyString) ? value : null;
}

function mapAlternatives(value: unknown): Alternative[] | null {
  if (!Array.isArray(value) || value.length < 2 || value.length > 5) return null;
  const alternatives = value.map((item) => {
    if (!isObject(item) || !ALTERNATIVE_IDS.includes(item.id as AlternativeId)) return null;
    if (!isNonEmptyString(item.text)) return null;
    return { id: item.id as AlternativeId, text: item.text };
  });
  if (alternatives.some((item) => item === null)) return null;
  const typed = alternatives as Alternative[];
  return new Set(typed.map((item) => item.id)).size === typed.length ? typed : null;
}

export function mapPublishedQuestion(value: unknown): Question | null {
  if (!isObject(value)) return null;
  const alternatives = mapAlternatives(value.alternatives);
  const year = numberFrom(value.year);
  const difficulty = value.difficulty === undefined || value.difficulty === null
    ? undefined
    : value.difficulty;
  if (
    !isNonEmptyString(value.id) ||
    !isNonEmptyString(value.discipline) ||
    !isNonEmptyString(value.subject) ||
    !isNonEmptyString(value.topic) ||
    !isNonEmptyString(value.board) ||
    year === null ||
    !Number.isInteger(year) ||
    !isNonEmptyString(value.role) ||
    !isNonEmptyString(value.institution) ||
    !isNonEmptyString(value.concurso) ||
    !EDUCATION_LEVELS.includes(value.level as EducationLevel) ||
    (difficulty !== undefined && !DIFFICULTIES.includes(difficulty as Difficulty)) ||
    !isNonEmptyString(value.statement) ||
    !alternatives ||
    !ALTERNATIVE_IDS.includes(value.correct as AlternativeId) ||
    !alternatives.some((item) => item.id === value.correct)
  ) {
    return null;
  }

  return {
    id: value.id,
    discipline: value.discipline,
    subject: value.subject,
    topic: value.topic,
    board: value.board,
    year,
    role: value.role,
    institution: value.institution,
    concurso: value.concurso,
    level: value.level as EducationLevel,
    ...(difficulty === undefined ? {} : { difficulty: difficulty as Difficulty }),
    statement: value.statement,
    alternatives,
    correct: value.correct as AlternativeId,
    explanation: optionalString(value.explanation),
  };
}

function mapRole(value: unknown): (ConcursoRole & { sortOrder: number }) | null {
  if (!isObject(value)) return null;
  const vacancies = numberFrom(value.vacancies);
  const salary = numberFrom(value.salary);
  const sortOrder = numberFrom(value.sort_order);
  if (
    !isNonEmptyString(value.name) ||
    vacancies === null ||
    salary === null ||
    sortOrder === null ||
    !EDUCATION_LEVELS.includes(value.level as EducationLevel)
  ) {
    return null;
  }
  return {
    name: value.name,
    vacancies,
    salary,
    level: value.level as EducationLevel,
    sortOrder,
  };
}

export function mapPublishedConcurso(value: unknown): Concurso | null {
  if (!isObject(value)) return null;
  const levels = stringArray(value.levels);
  const highlights = stringArray(value.highlights);
  const vacancies = numberFrom(value.vacancies);
  const salaryMin = numberFrom(value.salary_min);
  const salaryMax = numberFrom(value.salary_max);
  const fee = value.fee === null || value.fee === undefined ? undefined : numberFrom(value.fee);
  const roles = Array.isArray(value.concurso_roles) ? value.concurso_roles.map(mapRole) : [];
  if (
    !isNonEmptyString(value.id) ||
    !isNonEmptyString(value.short_name) ||
    !isNonEmptyString(value.organ) ||
    !isNonEmptyString(value.title) ||
    !isNonEmptyString(value.board) ||
    !isNonEmptyString(value.state) ||
    !REGIONS.includes(value.region as Region) ||
    !levels ||
    !levels.every((level) => EDUCATION_LEVELS.includes(level as EducationLevel)) ||
    vacancies === null ||
    salaryMin === null ||
    salaryMax === null ||
    fee === null ||
    !['aberto', 'previsto', 'encerrado'].includes(String(value.status)) ||
    !highlights ||
    !isNonEmptyString(value.edital_url) ||
    !value.edital_url.startsWith('https://') ||
    !isNonEmptyString(value.updated_at) ||
    roles.some((role) => role === null)
  ) {
    return null;
  }

  return {
    id: value.id,
    shortName: value.short_name,
    icon: optionalString(value.icon),
    iconColor: optionalString(value.icon_color),
    organ: value.organ,
    title: value.title,
    board: value.board,
    state: value.state,
    city: optionalString(value.city),
    region: value.region as Region,
    levels: levels as EducationLevel[],
    vacancies,
    salaryMin,
    salaryMax,
    registrationStart: optionalString(value.registration_start),
    registrationEnd: optionalString(value.registration_end),
    examDate: optionalString(value.exam_date),
    fee,
    status: value.status as Concurso['status'],
    roles: (roles as (ConcursoRole & { sortOrder: number })[])
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map(({ sortOrder: _sortOrder, ...role }) => role),
    highlights,
    editalUrl: value.edital_url,
    updatedAt: value.updated_at,
    contentSource: value.source_provider === 'kad-demo-catalog' ? 'demo' : 'published',
  };
}

export function mapPublishedQuestions(values: unknown): Question[] {
  if (!Array.isArray(values)) return [];
  return values.map(mapPublishedQuestion).filter((item): item is Question => item !== null);
}

export function mapPublishedConcursos(values: unknown): Concurso[] {
  if (!Array.isArray(values)) return [];
  return values.map(mapPublishedConcurso).filter((item): item is Concurso => item !== null);
}
