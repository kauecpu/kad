import assert from 'node:assert/strict';
import test from 'node:test';

import { CONCURSO_PACKS } from '../data/exam-concursos.ts';
import { ESSAY_TOPICS } from '../data/essay-topics.ts';
import {
  essayTopicDisclosure,
  filterEssayTopics,
  INITIAL_ESSAY_TOPIC_COUNT,
} from '../lib/essay-discovery.ts';

const recommendedTopic = ESSAY_TOPICS[0];

test('a exploração inicial separa a recomendação e mostra somente três alternativas', () => {
  const result = essayTopicDisclosure({
    topics: ESSAY_TOPICS,
    recommendedTopicId: recommendedTopic.id,
    hasActiveDiscovery: false,
    expanded: false,
  });

  assert.equal(result.visibleTopics.length, INITIAL_ESSAY_TOPIC_COUNT);
  assert.ok(result.visibleTopics.every((topic) => topic.id !== recommendedTopic.id));
  assert.equal(result.hiddenCount, ESSAY_TOPICS.length - INITIAL_ESSAY_TOPIC_COUNT - 1);
});

test('ver todos revela as alternativas restantes sem duplicar a recomendação', () => {
  const result = essayTopicDisclosure({
    topics: ESSAY_TOPICS,
    recommendedTopicId: recommendedTopic.id,
    hasActiveDiscovery: false,
    expanded: true,
  });

  assert.equal(result.visibleTopics.length, ESSAY_TOPICS.length - 1);
  assert.equal(result.hiddenCount, 0);
});

test('busca ativa mostra todos os resultados e pode reencontrar a recomendação', () => {
  const filtered = filterEssayTopics({
    topics: ESSAY_TOPICS,
    packs: CONCURSO_PACKS,
    query: 'justica',
    packId: 'all',
  });
  const result = essayTopicDisclosure({
    topics: filtered,
    recommendedTopicId: recommendedTopic.id,
    hasActiveDiscovery: true,
    expanded: false,
  });

  assert.equal(result.visibleTopics[0]?.id, recommendedTopic.id);
  assert.equal(result.hiddenCount, 0);
});

test('filtro compacto limita propostas ao concurso escolhido', () => {
  const filtered = filterEssayTopics({
    topics: ESSAY_TOPICS,
    packs: CONCURSO_PACKS,
    query: '',
    packId: 'banco-do-brasil',
  });

  assert.ok(filtered.length > 0);
  assert.ok(filtered.every((topic) => topic.packId === 'banco-do-brasil'));
});
