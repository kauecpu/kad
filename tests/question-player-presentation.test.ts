import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { URL as NodeURL } from 'node:url';

const source = (path: string) => readFileSync(new NodeURL(path, import.meta.url), 'utf8');
const topicPlayer = source('../app/questoes/[discipline]/[topic].tsx');
const questionCard = source('../components/question-card.tsx');
const communityStat = source('../components/question-community-stat.tsx');

test('player mostra progresso e filtros com rótulos visíveis', () => {
  assert.match(topicPlayer, /Questão \$\{index \+ 1\} de \$\{questions\.length\}/);
  assert.match(topicPlayer, /showLabel/);
  assert.match(topicPlayer, /label="Próxima questão"/);
  assert.match(topicPlayer, /label="Concluir sessão"/);
});

test('resultado evita repetir o estado e mantém metadados legíveis', () => {
  assert.doesNotMatch(questionCard, /label=\{isCorrect \? 'Acertou' : 'Errou'\}/);
  assert.match(questionCard, /business-outline/);
  assert.match(questionCard, /briefcase-outline/);
  assert.match(questionCard, /showPosition \? \(/);
  assert.match(topicPlayer, /showPosition=\{false\}/);
});

test('gabarito usa uma única superfície e tentativa secundária clara', () => {
  assert.match(questionCard, /styles\.explanationCard/);
  assert.match(questionCard, /label="Tentar novamente"/);
  assert.match(questionCard, /variant="secondary"/);
});

test('estatística comunitária não renderiza barra sem amostra', () => {
  assert.match(communityStat, /summary\.hasSample \? \(/);
  assert.match(communityStat, /summary\.detailLabel/);
});
