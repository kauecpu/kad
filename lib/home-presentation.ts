export type HomeSimulationState = {
  status: 'active' | 'paused' | 'completed';
  answered: number;
  total: number;
};

export type HomePrimaryAction = {
  eyebrow: string;
  title: string;
  description: string;
  route: '/meta' | '/questoes' | '/questoes/simulado' | '/questoes/simulado/resultado';
  progress?: number;
};

export type HomePrimaryVisual = {
  tone: 'brand' | 'achievement';
};

export function getHomePrimaryVisual(
  action: Pick<HomePrimaryAction, 'route'>
): HomePrimaryVisual {
  switch (action.route) {
    case '/meta':
      return { tone: 'brand' };
    case '/questoes':
      return { tone: 'brand' };
    case '/questoes/simulado':
      return { tone: 'brand' };
    case '/questoes/simulado/resultado':
      return { tone: 'achievement' };
  }
}

export function getHomePrimaryAction({
  hasGoal,
  simulation,
}: {
  hasGoal: boolean;
  simulation?: HomeSimulationState;
}): HomePrimaryAction {
  if (simulation?.status === 'completed') {
    return {
      eyebrow: 'ÚLTIMO SIMULADO',
      title: 'Revisar resultado',
      description: 'Confira seu desempenho e reveja cada resposta.',
      route: '/questoes/simulado/resultado',
      progress: 100,
    };
  }

  if (simulation) {
    const total = Math.max(1, simulation.total);
    const answered = Math.min(Math.max(0, simulation.answered), total);

    return {
      eyebrow: 'SIMULADO EM ANDAMENTO',
      title: 'Continuar simulado',
      description: `${answered} de ${total} questões respondidas`,
      route: '/questoes/simulado',
      progress: (answered / total) * 100,
    };
  }

  if (!hasGoal) {
    return {
      eyebrow: 'SEU PRIMEIRO PASSO',
      title: 'Escolher meu concurso',
      description: 'Defina sua direção para o KAD organizar sua preparação.',
      route: '/meta',
    };
  }

  return {
    eyebrow: 'PRÓXIMA SESSÃO',
    title: 'Começar a estudar',
    description: 'Escolha uma matéria e avance na sua preparação.',
    route: '/questoes',
  };
}
