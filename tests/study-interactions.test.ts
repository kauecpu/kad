import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createStudyActionGate,
  performStudyAction,
  resolveStudyOptionState,
} from '../lib/study-interactions.ts';
import { MOTION_DURATION, resolveMotionDuration } from '../constants/motion.ts';

test('estado visual distingue seleção, acerto, erro e alternativas neutras', () => {
  assert.equal(
    resolveStudyOptionState({ selected: false, answered: false, correct: false }),
    'idle'
  );
  assert.equal(
    resolveStudyOptionState({ selected: true, answered: false, correct: false }),
    'selected'
  );
  assert.equal(
    resolveStudyOptionState({ selected: true, answered: true, correct: true }),
    'correct'
  );
  assert.equal(
    resolveStudyOptionState({ selected: true, answered: true, correct: false }),
    'incorrect'
  );
  assert.equal(
    resolveStudyOptionState({ selected: false, answered: true, correct: false }),
    'muted'
  );
});

test('gabarito correto permanece destacado mesmo quando não foi a alternativa escolhida', () => {
  assert.equal(
    resolveStudyOptionState({ selected: false, answered: true, correct: true }),
    'correct'
  );
});

test('toques repetidos executam a mutação e o feedback apenas uma vez', () => {
  const gate = createStudyActionGate();
  const savedAnswers: string[] = [];
  let feedbackCount = 0;

  const answer = () =>
    performStudyAction({
      gate,
      commit: () => savedAnswers.push('B'),
      feedback: () => {
        feedbackCount += 1;
      },
    });

  assert.equal(answer(), true);
  assert.equal(answer(), false);
  assert.deepEqual(savedAnswers, ['B']);
  assert.equal(feedbackCount, 1);

  gate.reset();
  assert.equal(answer(), true);
  assert.deepEqual(savedAnswers, ['B', 'B']);
});

test('persistência não aguarda o término do feedback complementar', () => {
  const gate = createStudyActionGate();
  let committed = false;

  const accepted = performStudyAction({
    gate,
    commit: () => {
      committed = true;
    },
    feedback: () => new Promise<void>(() => {}),
  });

  assert.equal(accepted, true);
  assert.equal(committed, true);
});

test('falha síncrona do feedback não desfaz resposta nem favorito já confirmados', () => {
  const gate = createStudyActionGate();
  const studyState = { answer: '', favorite: false };

  assert.doesNotThrow(() => {
    performStudyAction({
      gate,
      commit: () => {
        studyState.answer = 'C';
        studyState.favorite = true;
      },
      feedback: () => {
        throw new Error('feedback indisponível');
      },
    });
  });

  assert.deepEqual(studyState, { answer: 'C', favorite: true });
});

test('redução de movimento entrega imediatamente o estado final das interações', () => {
  assert.ok(MOTION_DURATION.selection > 0);
  assert.ok(MOTION_DURATION.reaction > 0);
  assert.ok(MOTION_DURATION.expand > 0);
  assert.ok(MOTION_DURATION.icon > 0);
  assert.equal(resolveMotionDuration('selection', true), 0);
  assert.equal(resolveMotionDuration('reaction', true), 0);
  assert.equal(resolveMotionDuration('expand', true), 0);
  assert.equal(resolveMotionDuration('icon', true), 0);
});
