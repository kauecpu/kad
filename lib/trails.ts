import type { Difficulty, Question } from '../types/index.ts';

export type TrailLevel = {
  number: number;
  title: string;
  description: string;
  tip: string;
  questions: Question[];
  topics: string[];
};

const LEVELS = [
  {
    title: 'Iniciante',
    description: 'Comece pelos conceitos mais acessíveis e reconheça o formato das questões.',
    tip: 'Leia o enunciado com calma antes de observar as alternativas.',
  },
  {
    title: 'Primeiros conceitos',
    description: 'Reforce a base e identifique os pontos mais frequentes do conteúdo.',
    tip: 'Use o gabarito comentado para entender também as alternativas incorretas.',
  },
  {
    title: 'Fundamentos',
    description: 'Pratique os fundamentos até reconhecer os padrões de cobrança.',
    tip: 'Anote os conceitos que aparecem novamente durante a prática.',
  },
  {
    title: 'Base prática',
    description: 'Aplique os fundamentos em questões com mais detalhes no enunciado.',
    tip: 'Tente responder antes de consultar a explicação da questão.',
  },
  {
    title: 'Intermediário',
    description: 'Combine interpretação, conteúdo e atenção às alternativas.',
    tip: 'Revise os erros antes de avançar para uma nova sessão.',
  },
  {
    title: 'Consolidação',
    description: 'Fortaleça os assuntos já estudados com prática recorrente.',
    tip: 'Alterne assuntos para não depender apenas da memorização da ordem.',
  },
  {
    title: 'Aplicação',
    description: 'Resolva questões que exigem mais segurança na aplicação dos conceitos.',
    tip: 'Marque as palavras decisivas do enunciado antes de escolher a resposta.',
  },
  {
    title: 'Desafios',
    description: 'Enfrente questões mais exigentes e compare diferentes abordagens.',
    tip: 'Controle o tempo sem abrir mão da leitura completa do enunciado.',
  },
  {
    title: 'Revisão avançada',
    description: 'Retome pontos frágeis e refine sua estratégia de resolução.',
    tip: 'Dê prioridade aos assuntos em que seus erros ainda se repetem.',
  },
  {
    title: 'Avançado',
    description: 'Pratique no nível mais alto da trilha e consolide sua preparação.',
    tip: 'Responda como em prova: com tempo definido e sem consultar materiais.',
  },
] as const;

const difficultyOrder: Record<Difficulty, number> = {
  Fácil: 0,
  Média: 1,
  Difícil: 2,
};

export function questionsForDisciplines(
  questions: Question[],
  disciplines: string[]
): Question[] {
  return questions.filter((question) => disciplines.includes(question.discipline));
}

/**
 * Distribui cada questão uma única vez ao longo dos dez níveis. Quando o banco ainda não possui
 * conteúdo suficiente, os níveis sem atividade permanecem vazios em vez de repetir questões.
 */
export function createTrailLevels(questions: Question[]): TrailLevel[] {
  const ordered = [...questions].sort(
    (a, b) =>
      (a.difficulty ? difficultyOrder[a.difficulty] : Number.POSITIVE_INFINITY) -
        (b.difficulty ? difficultyOrder[b.difficulty] : Number.POSITIVE_INFINITY) ||
      a.discipline.localeCompare(b.discipline, 'pt-BR') ||
      a.topic.localeCompare(b.topic, 'pt-BR') ||
      a.id.localeCompare(b.id)
  );

  const questionsByLevel: Question[][] = Array.from({ length: LEVELS.length }, () => []);
  const activeLevelCount = Math.min(LEVELS.length, ordered.length);
  ordered.forEach((question, index) => {
    const levelIndex = Math.min(
      activeLevelCount - 1,
      Math.floor((index * activeLevelCount) / ordered.length)
    );
    questionsByLevel[levelIndex].push(question);
  });

  return LEVELS.map((definition, index) => {
    const levelQuestions = questionsByLevel[index];

    return {
      number: index + 1,
      ...definition,
      questions: levelQuestions,
      topics: Array.from(new Set(levelQuestions.map((question) => question.topic))),
    };
  });
}
