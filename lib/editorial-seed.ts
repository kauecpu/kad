import { CONCURSOS } from '../data/concursos.ts';
import { QUESTIONS } from '../data/questions.ts';

const QUESTION_SOURCE_URL = 'https://github.com/kauecpu/kad/blob/main/data/questions.ts';

export type InitialCatalogSeed = {
  concursos: Record<string, unknown>[];
  questions: Record<string, unknown>[];
};

export type InitialCatalogImportRecord = {
  schemaVersion: 1;
  kind: 'concurso' | 'question';
  source: {
    provider: string;
    externalId: string;
    url: string;
    collectedAt: string;
  };
  data: Record<string, unknown> & { id: string };
};

/**
 * Converte o acervo inicial do aplicativo para o contrato já aceito pelas RPCs
 * editoriais. O conteúdo é publicado por uma sessão administrativa auditada.
 */
export function buildInitialCatalogSeed(
  collectedAt = new Date().toISOString(),
): InitialCatalogSeed {
  const publicationFields = {
    publicationStatus: 'published',
    publishedAt: collectedAt,
    updatedAt: collectedAt,
  };

  return {
    concursos: CONCURSOS.map((concurso) => ({
      id: concurso.id,
      shortName: concurso.shortName,
      icon: concurso.icon ?? 'business-outline',
      iconColor: concurso.iconColor ?? '#6D28D9',
      organ: concurso.organ,
      title: concurso.title,
      board: concurso.board,
      state: concurso.state,
      city: concurso.city,
      region: concurso.region,
      levels: concurso.levels,
      vacancies: concurso.vacancies,
      salaryMin: concurso.salaryMin,
      salaryMax: concurso.salaryMax,
      registrationStart: concurso.registrationStart,
      registrationEnd: concurso.registrationEnd,
      examDate: concurso.examDate,
      fee: concurso.fee,
      status: concurso.status,
      roles: concurso.roles,
      highlights: concurso.highlights,
      editalUrl: concurso.editalUrl,
      ...publicationFields,
    })),
    questions: QUESTIONS.map((question) => ({
      ...question,
      ...publicationFields,
      sourceProvider: 'kad-authored-catalog',
      sourceExternalId: question.id,
      sourceUrl: QUESTION_SOURCE_URL,
      sourceCollectedAt: collectedAt,
    })),
  };
}

export function buildInitialCatalogImportRecords(
  collectedAt = new Date().toISOString(),
): InitialCatalogImportRecord[] {
  const seed = buildInitialCatalogSeed(collectedAt);
  return [
    ...seed.concursos.map((concurso) => ({
      schemaVersion: 1 as const,
      kind: 'concurso' as const,
      source: {
        provider: 'kad-demo-catalog',
        externalId: String(concurso.id),
        url: String(concurso.editalUrl),
        collectedAt,
      },
      data: concurso as Record<string, unknown> & { id: string },
    })),
    ...seed.questions.map((question) => ({
      schemaVersion: 1 as const,
      kind: 'question' as const,
      source: {
        provider: 'kad-authored-catalog',
        externalId: String(question.id),
        url: QUESTION_SOURCE_URL,
        collectedAt,
      },
      data: question as Record<string, unknown> & { id: string },
    })),
  ];
}
