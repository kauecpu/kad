import { CONCURSOS } from '../../../data/concursos.ts';
import { DISCIPLINES } from '../../../data/disciplines.ts';
import { ESSAY_TOPICS } from '../../../data/essay-topics.ts';
import { CONCURSO_PACKS } from '../../../data/exam-concursos.ts';
import { QUESTIONS } from '../../../data/questions.ts';
import { RANKING_PARTICIPANTS } from '../../../data/ranking.ts';

/**
 * Fronteira explícita entre os frontends. Estes módulos contêm somente dados e
 * tipos apagados no build; nenhuma dependência de Expo chega ao site.
 */
export const staticCatalog = Object.freeze({
  concursos: CONCURSOS,
  disciplines: DISCIPLINES,
  essayTopics: ESSAY_TOPICS,
  packs: CONCURSO_PACKS,
  questions: QUESTIONS,
  rankingParticipants: RANKING_PARTICIPANTS,
});

let liveCatalog = {
  ...staticCatalog,
  concursos: [...staticCatalog.concursos],
  questions: [...staticCatalog.questions],
};

export function getCatalog() {
  return liveCatalog;
}
export function replacePublishedCatalog({ questions, concursos }) {
  liveCatalog = {
    ...liveCatalog,
    questions: Array.isArray(questions) && questions.length ? questions : liveCatalog.questions,
    concursos: Array.isArray(concursos) && concursos.length ? concursos : liveCatalog.concursos,
  };
  return liveCatalog;
}

export function resetCatalog() {
  liveCatalog = {
    ...staticCatalog,
    concursos: [...staticCatalog.concursos],
    questions: [...staticCatalog.questions],
  };
}
