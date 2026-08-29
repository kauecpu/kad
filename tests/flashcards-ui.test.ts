import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const routePath = decodeURIComponent(new URL('../app/flashcards.tsx', import.meta.url).pathname).replace(/^\/(\w):/, '$1:');
const routeSource = () => readFileSync(routePath, 'utf8');

test('rota Flashcards existe e oferece criação e revisão', () => {
  assert.equal(existsSync(routePath), true);
  const source = routeSource();
  assert.match(source, /Flashcards/);
  assert.match(source, /Novo baralho/);
  assert.match(source, /Revisar agora/);
  assert.match(source, /Errei/);
  assert.match(source, /Fácil/);
  assert.match(source, /Arquivados/);
  assert.match(source, /Restaurar/);
});

test('catálogo e drawer exibem Flashcards como função própria', () => {
  const catalogPath = decodeURIComponent(new URL('../lib/app-feature-catalog.ts', import.meta.url).pathname).replace(/^\/(\w):/, '$1:');
  const catalog = readFileSync(catalogPath, 'utf8');
  assert.match(catalog, /id: 'flashcards'/);
  assert.match(catalog, /title: 'Flashcards'/);
  assert.match(catalog, /href: '\/flashcards'/);
});

