import type { AlternativeId, Concurso, Question } from '../types/domain.ts';

type JsonObject = Record<string, unknown>;
const ALTERNATIVE_IDS = new Set<AlternativeId>(['A', 'B', 'C', 'D', 'E']);
const LEVELS = new Set(['Fundamental', 'Médio', 'Superior']);
const DIFFICULTIES = new Set(['Fácil', 'Média', 'Difícil']);
const REGIONS = new Set(['Norte', 'Nordeste', 'Centro-Oeste', 'Sudeste', 'Sul', 'Nacional']);

function object(value: unknown): value is JsonObject {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function text(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function optionalText(value: unknown): string | undefined {
  return text(value) ? value : undefined;
}

function number(value: unknown): number | null {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function textArray(value: unknown): string[] | null {
  return Array.isArray(value) && value.every(text) ? value : null;
}

export function mapPublishedQuestions(value: unknown): Question[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((candidate) => {
    if (!object(candidate)) return [];
    const year = number(candidate.year);
    const alternatives = Array.isArray(candidate.alternatives)
      ? candidate.alternatives.flatMap((alternative) => object(alternative)
        && ALTERNATIVE_IDS.has(alternative.id as AlternativeId)
        && text(alternative.text)
        ? [{ id: alternative.id as AlternativeId, text: alternative.text }]
        : [])
      : [];
    const ids = new Set(alternatives.map((alternative) => alternative.id));
    const difficulty = candidate.difficulty === null || candidate.difficulty === undefined
      ? undefined
      : candidate.difficulty;
    if (
      !text(candidate.id)
      || !text(candidate.discipline)
      || !text(candidate.subject)
      || !text(candidate.topic)
      || !text(candidate.board)
      || year === null
      || !Number.isInteger(year)
      || !text(candidate.role)
      || !text(candidate.institution)
      || !text(candidate.concurso)
      || !LEVELS.has(String(candidate.level))
      || (difficulty !== undefined && !DIFFICULTIES.has(String(difficulty)))
      || !text(candidate.statement)
      || alternatives.length < 2
      || alternatives.length > 5
      || ids.size !== alternatives.length
      || !ALTERNATIVE_IDS.has(candidate.correct as AlternativeId)
      || !ids.has(candidate.correct as AlternativeId)
    ) return [];
    return [{
      id: candidate.id,
      discipline: candidate.discipline,
      subject: candidate.subject,
      topic: candidate.topic,
      board: candidate.board,
      year,
      role: candidate.role,
      institution: candidate.institution,
      concurso: candidate.concurso,
      level: candidate.level as Question['level'],
      ...(difficulty ? { difficulty: difficulty as Question['difficulty'] } : {}),
      statement: candidate.statement,
      alternatives,
      correct: candidate.correct as AlternativeId,
      explanation: optionalText(candidate.explanation),
    }];
  });
}

export function mapPublishedConcursos(value: unknown): Concurso[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((candidate) => {
    if (!object(candidate)) return [];
    const levels = textArray(candidate.levels);
    const highlights = textArray(candidate.highlights);
    const vacancies = number(candidate.vacancies);
    const salaryMin = number(candidate.salary_min);
    const salaryMax = number(candidate.salary_max);
    const fee = candidate.fee === null || candidate.fee === undefined ? undefined : number(candidate.fee);
    const roles = Array.isArray(candidate.concurso_roles) ? candidate.concurso_roles.map((role) => {
      if (!object(role)) return null;
      const roleVacancies = number(role.vacancies);
      const salary = number(role.salary);
      const sortOrder = number(role.sort_order);
      if (!text(role.name) || roleVacancies === null || salary === null || sortOrder === null || !LEVELS.has(String(role.level))) return null;
      return { name: role.name, vacancies: roleVacancies, salary, level: role.level as Concurso['levels'][number], sortOrder };
    }) : [];
    if (
      !text(candidate.id)
      || !text(candidate.short_name)
      || !text(candidate.organ)
      || !text(candidate.title)
      || !text(candidate.board)
      || !text(candidate.state)
      || !REGIONS.has(String(candidate.region))
      || !levels
      || !levels.every((level) => LEVELS.has(level))
      || vacancies === null
      || salaryMin === null
      || salaryMax === null
      || fee === null
      || !['aberto', 'previsto', 'encerrado'].includes(String(candidate.status))
      || !highlights
      || !text(candidate.edital_url)
      || !candidate.edital_url.startsWith('https://')
      || !text(candidate.updated_at)
      || roles.some((role) => role === null)
    ) return [];
    return [{
      id: candidate.id,
      shortName: candidate.short_name,
      icon: optionalText(candidate.icon),
      iconColor: optionalText(candidate.icon_color),
      organ: candidate.organ,
      title: candidate.title,
      board: candidate.board,
      state: candidate.state,
      city: optionalText(candidate.city),
      region: candidate.region as Concurso['region'],
      levels: levels as Concurso['levels'],
      vacancies,
      salaryMin,
      salaryMax,
      registrationStart: optionalText(candidate.registration_start),
      registrationEnd: optionalText(candidate.registration_end),
      examDate: optionalText(candidate.exam_date),
      fee,
      status: candidate.status as Concurso['status'],
      roles: roles
        .filter((role): role is NonNullable<typeof role> => role !== null)
        .sort((left, right) => left.sortOrder - right.sortOrder)
        .map(({ sortOrder: _sortOrder, ...role }) => role),
      highlights,
      editalUrl: candidate.edital_url,
      updatedAt: candidate.updated_at,
      contentSource: candidate.source_provider === 'kad-demo-catalog' ? 'demo' : 'published',
    }];
  });
}
