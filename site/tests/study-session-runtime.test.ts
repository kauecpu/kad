import assert from 'node:assert/strict';
import test from 'node:test';
import { createStore, recordAnswer } from '../src/core/store.ts';
import { getCatalog, replacePublishedCatalog, resetCatalog } from '../src/data/catalog.ts';
import { questionSessionView } from '../src/views/questions.ts';
import type { UiState } from '../src/types/domain.ts';

test('unanswered filter keeps the answered question and its result until navigation', () => {
  resetCatalog();
  const s = createStore(undefined);
  const ui = { questionIndex: 0, visitedQuestionIds: new Set<string>() } as UiState;
  const question = getCatalog().questions[0];
  questionSessionView(s.getState(), { status: 'unanswered' }, ui);
  s.update(draft => recordAnswer(draft, question, question.correct));
  const after = questionSessionView(s.getState(), { status: 'unanswered' }, ui);
  assert.ok(after.content.includes('Resposta correta'));
  assert.ok(after.content.includes(`data-question-id="${question.id}"`));
});
test('large question session renders at most 43 map buttons, retaining first and last navigation', () => {
  resetCatalog();
  const sample = getCatalog().questions[0];
  replacePublishedCatalog({ questions: Array.from({ length: 5000 }, (_, i) => ({ ...sample, id: `synthetic-${i}` })) });
  const s = createStore(undefined);
  const ui = { questionIndex: 2500, visitedQuestionIds: new Set<string>() } as UiState;
  const view = questionSessionView(s.getState(), {}, ui);
  assert.ok((view.content.match(/data-action="go-question"/g) ?? []).length <= 43);
  assert.ok(view.content.includes('data-index="0"'));
  assert.ok(view.content.includes('data-index="4999"'));
  resetCatalog();
});
