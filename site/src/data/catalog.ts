import { CONCURSOS } from '../../../data/concursos.ts';
import { DISCIPLINES } from '../../../data/disciplines.ts';
import { ESSAY_TOPICS } from '../../../data/essay-topics.ts';
import { CONCURSO_PACKS } from '../../../data/exam-concursos.ts';
import { QUESTIONS } from '../../../data/questions.ts';
import { RANKING_PARTICIPANTS } from '../../../data/ranking.ts';
import { buildQuestionPacks } from '../core/question-catalog.ts';
import type { Concurso, Question, SiteCatalog } from '../types/domain.ts';

/**
 * Fronteira explícita entre os frontends. Estes módulos contêm somente dados e
 * tipos apagados no build; nenhuma dependência de Expo chega ao site.
 */
export const staticCatalog: Readonly<SiteCatalog> = Object.freeze({
  concursos: CONCURSOS,
  disciplines: DISCIPLINES,
  essayTopics: ESSAY_TOPICS,
  packs: CONCURSO_PACKS,
  questions: QUESTIONS,
  rankingParticipants: RANKING_PARTICIPANTS,
});

let liveCatalog: SiteCatalog = {
  ...staticCatalog,
  concursos: [...staticCatalog.concursos],
  questions: [...staticCatalog.questions],
};

export function getCatalog(): SiteCatalog {
  return liveCatalog;
}
export function replacePublishedCatalog({ questions, concursos }: { questions?: Question[]; concursos?: Concurso[] }): SiteCatalog {
  const publishedQuestions = Array.isArray(questions) ? questions : liveCatalog.questions;
  liveCatalog = {
    ...liveCatalog,
    questions: publishedQuestions,
    concursos: Array.isArray(concursos) ? concursos : liveCatalog.concursos,
    packs: buildQuestionPacks(publishedQuestions, Array.isArray(questions)),
  };
  return liveCatalog;
}

export function resetCatalog(): void {
  liveCatalog = {
    ...staticCatalog,
    concursos: [...staticCatalog.concursos],
    questions: [...staticCatalog.questions],
  };
}
