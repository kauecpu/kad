import assert from 'node:assert/strict';
import test from 'node:test';

import {
  getHomePrimaryAction,
  getHomePrimaryVisual,
} from '../lib/home-presentation.ts';

test('prioriza a escolha do concurso quando o estudante ainda não tem meta', () => {
  assert.deepEqual(getHomePrimaryAction({ hasGoal: false, hasWrongAnswers: true }), {
    eyebrow: 'SEU PRIMEIRO PASSO',
    title: 'Escolher meu concurso',
    description: 'Defina sua direção para o KAD organizar sua preparação.',
    route: '/meta',
  });
});

test('oferece a revisão do dia quando há erros reais e uma meta definida', () => {
  const action = getHomePrimaryAction({ hasGoal: true, hasWrongAnswers: true });

  assert.equal(action.title, 'Revisão de hoje');
  assert.equal(action.route, '/perfil/desempenho/questoes?tipo=wrong');
  assert.match(action.description, /questões que você errou/i);
});

test('usa o desafio diário como fallback honesto', () => {
  const action = getHomePrimaryAction({ hasGoal: true, hasWrongAnswers: false });

  assert.equal(action.title, 'Desafio diário');
  assert.equal(action.route, '/questoes/desafio');
  assert.doesNotMatch(action.title, /continuar/i);
});

test('um simulado em andamento supera as demais ações', () => {
  const action = getHomePrimaryAction({
    hasGoal: false,
    hasWrongAnswers: true,
    simulation: { status: 'paused', answered: 7, total: 20 },
  });

  assert.equal(action.title, 'Continuar simulado');
  assert.equal(action.route, '/questoes/simulado');
  assert.equal(action.description, '7 de 20 questões respondidas');
  assert.equal(action.progress, 35);
});

test('um simulado concluído direciona para a revisão real', () => {
  const action = getHomePrimaryAction({
    hasGoal: true,
    hasWrongAnswers: true,
    simulation: { status: 'completed', answered: 10, total: 10 },
  });

  assert.equal(action.title, 'Revisar resultado');
  assert.equal(action.route, '/questoes/simulado/resultado');
  assert.equal(action.progress, 100);
});

test('a apresentação da ação principal deriva somente da rota real', () => {
  assert.deepEqual(getHomePrimaryVisual({ route: '/meta' }), { tone: 'brand' });
  assert.deepEqual(
    getHomePrimaryVisual({ route: '/perfil/desempenho/questoes?tipo=wrong' }),
    { tone: 'brand' }
  );
  assert.deepEqual(getHomePrimaryVisual({ route: '/questoes/desafio' }), { tone: 'brand' });
  assert.deepEqual(getHomePrimaryVisual({ route: '/questoes/simulado' }), { tone: 'brand' });
  assert.deepEqual(getHomePrimaryVisual({ route: '/questoes/simulado/resultado' }), {
    tone: 'achievement',
  });
});
