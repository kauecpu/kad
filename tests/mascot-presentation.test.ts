import assert from 'node:assert/strict';
import test from 'node:test';

import { getOnboardingSlideAccessibilityLabel } from '../constants/mascots.ts';

test('cada slide agrupa etapa, copy e pose exata em um único label', () => {
  const expectations = [
    {
      input: {
        index: 0,
        total: 4,
        title: 'Seu estudo, com direção',
        description:
          'O KAD reúne o que você precisa para estudar sem se perder entre materiais e oportunidades.',
        mascot: 'welcome',
      },
      label:
        'Etapa 1 de 4. Seu estudo, com direção. O KAD reúne o que você precisa para estudar sem se perder entre materiais e oportunidades. Mascote KAD escrevendo com um lápis',
    },
    {
      input: {
        index: 1,
        total: 4,
        title: 'Aprenda resolvendo',
        description:
          'Escolha uma disciplina, pratique por assunto e acompanhe sua evolução a cada sessão.',
        mascot: 'practice',
      },
      label:
        'Etapa 2 de 4. Aprenda resolvendo. Escolha uma disciplina, pratique por assunto e acompanhe sua evolução a cada sessão. Mascote KAD em pé segurando um lápis',
    },
    {
      input: {
        index: 2,
        total: 4,
        title: 'Simule o dia da prova',
        description: 'Monte simulados, controle o tempo e revise cada resposta quando terminar.',
        mascot: 'simulation',
      },
      label:
        'Etapa 3 de 4. Simule o dia da prova. Monte simulados, controle o tempo e revise cada resposta quando terminar. Mascote KAD resolvendo uma prova com cronômetro',
    },
    {
      input: {
        index: 3,
        total: 4,
        title: 'Sua meta guia o KAD',
        description:
          'Salve concursos e escolha seu objetivo para receber recomendações mais úteis para você.',
        mascot: 'goal',
      },
      label:
        'Etapa 4 de 4. Sua meta guia o KAD. Salve concursos e escolha seu objetivo para receber recomendações mais úteis para você. Mascote KAD segurando uma bandeira de objetivo e um livro',
    },
  ] as const;

  for (const { input, label } of expectations) {
    assert.equal(getOnboardingSlideAccessibilityLabel(input), label);
  }
});
