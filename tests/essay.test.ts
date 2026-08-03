import assert from 'node:assert/strict';
import test from 'node:test';

import { CONCURSO_PACKS } from '../data/exam-concursos.ts';
import { ESSAY_TOPICS } from '../data/essay-topics.ts';

test('propostas de redação possuem concurso e critérios válidos', () => {
  const packIds = new Set(CONCURSO_PACKS.map((pack) => pack.id));
  const topicIds = ESSAY_TOPICS.map((topic) => topic.id);

  assert.equal(new Set(topicIds).size, topicIds.length);
  assert.ok(ESSAY_TOPICS.length > 0);

  for (const topic of ESSAY_TOPICS) {
    assert.ok(packIds.has(topic.packId), topic.title);
    assert.ok(topic.context.length > 40, topic.title);
    assert.ok(topic.command.length > 40, topic.title);
    assert.ok(topic.criteria.length >= 4, topic.title);
    assert.ok(topic.suggestedMinutes > 0, topic.title);
  }
});
