import assert from 'node:assert/strict';
import test from 'node:test';

import {
  getHomePrimaryAction,
  getHomePrimaryVisual,
} from '../lib/home-presentation.ts';

test('prioriza a escolha do concurso quando o estudante ainda não tem meta', () => {
  assert.deepEqual(getHomePrimaryAction({ hasGoal: false }), {
    eyebrow: 'SEU PRIMEIRO PASSO',
    title: 'Escolher meu concurso',
    description: 'Defina sua direção para o KAD organizar sua preparação.',
    route: '/meta',
  });
});

test('oferece uma nova sessão sem fingir que existe atividade pendente', () => {
  const action = getHomePrimaryAction({ hasGoal: true });

  assert.equal(action.title, 'Começar a estudar');
  assert.equal(action.route, '/questoes');
  assert.doesNotMatch(action.title, /continuar/i);
});

test('um simulado em andamento supera as demais ações', () => {
  const action = getHomePrimaryAction({
    hasGoal: false,
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
    simulation: { status: 'completed', answered: 10, total: 10 },
  });

  assert.equal(action.title, 'Revisar resultado');
  assert.equal(action.route, '/questoes/simulado/resultado');
  assert.equal(action.progress, 100);
});

test('a apresentação da ação principal deriva somente da rota real', () => {
  assert.deepEqual(getHomePrimaryVisual({ route: '/meta' }), {
    tone: 'brand',
  });
  assert.deepEqual(getHomePrimaryVisual({ route: '/questoes' }), {
    tone: 'brand',
  });
  assert.deepEqual(getHomePrimaryVisual({ route: '/questoes/simulado' }), {
    tone: 'brand',
  });
  assert.deepEqual(getHomePrimaryVisual({ route: '/questoes/simulado/resultado' }), {
    tone: 'achievement',
  });
});
