import { CONCURSOS } from '@/data/concursos';
import { CONCURSO_PACKS } from '@/data/exam-concursos';
import { QUESTIONS } from '@/data/questions';

/**
 * Cargos disponíveis para a meta do perfil.
 *
 * A lista é derivada das questões e dos editais para acompanhar automaticamente
 * a evolução das bases de dados do aplicativo.
 */
export const TARGET_ROLES = Array.from(
  new Set([
    ...QUESTIONS.map((question) => question.role),
    ...CONCURSOS.flatMap((concurso) => concurso.roles.map((role) => role.name)),
  ])
).sort((a, b) => a.localeCompare(b, 'pt-BR'));

/** Cargos e áreas amplas que podem orientar toda a experiência de estudo. */
export const TARGET_GOALS = Array.from(
  new Set([
    ...TARGET_ROLES,
    ...CONCURSO_PACKS.filter((pack) => pack.kind === 'area').map((pack) => pack.name),
  ])
).sort((a, b) => a.localeCompare(b, 'pt-BR'));
