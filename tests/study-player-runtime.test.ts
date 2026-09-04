import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { URL } from 'node:url';
import test from 'node:test';
import ts from 'typescript';
import { QUESTIONS } from '../data/questions.ts';
import * as filters from '../lib/questions.ts';
import * as journal from '../contracts/study-sync.ts';
import * as keys from '../lib/local-user-data-keys.ts';
import { createProtectedStorage } from '../lib/protected-storage-core.ts';
import { randomBytes } from 'node:crypto';

test('native topic player renders the empty-filter state instead of dereferencing a missing question', () => {
  const source = readFileSync(new URL('../app/questoes/[discipline]/[topic].tsx', import.meta.url), 'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  const exports: { default?: () => unknown } = {};
  const question = QUESTIONS[0];
  const emptyFilters = { subjects: [], boards: ['no-matching-board'], years: [], roles: [] };
  const mocks: Record<string, unknown> = {
    react: { useMemo: (fn: () => unknown) => fn(), useRef: () => ({ current: null }), useState: (value: unknown) => [value === filters.EMPTY_FILTERS ? emptyFilters : value, () => {}] },
    'react/jsx-runtime': { jsx: (type: unknown, props: unknown) => ({ type, props }), jsxs: (type: unknown, props: unknown) => ({ type, props }) },
    'react-native': { StyleSheet: { create: (s: unknown) => s }, View: 'View', Text: 'Text', ScrollView: 'ScrollView' },
    'expo-router': { useRouter: () => ({ back() {} }), useLocalSearchParams: () => ({ discipline: question.discipline, topic: question.topic }) },
    'react-native-safe-area-context': { useSafeAreaInsets: () => ({ bottom: 0 }) },
    '@/hooks/use-theme': { useTheme: () => ({ colors: {} }) },
    '@/providers/app-provider': { useApp: () => ({ answers: {}, answerQuestion() {}, resetQuestion() {} }) },
    '@/providers/questions-provider': { useQuestions: () => ({ questions: [question] }) },
    '@/lib/questions': filters,
    '@/constants/theme': { Spacing: {}, FontSize: {}, FontWeight: {} },
  };
  vm.runInNewContext(compiled, { exports, require: (name: string) => mocks[name] ?? {} });
  assert.doesNotThrow(() => exports.default!());
});

test('native adapter recovers an encrypted pending answer after controller recreation', async () => {
  const memory = () => {
    const data = new Map<string, string>();
    return { getItem: async (key: string) => data.get(key) ?? null,
      setItem: async (key: string, value: string) => { data.set(key, value); },
      removeItem: async (key: string) => { data.delete(key); } };
  };
  const protectedStorage = createProtectedStorage({ storage: memory(), keyStore: memory(), randomBytes: async n => randomBytes(n) });
  const source = readFileSync(new URL('../lib/study-sync.ts', import.meta.url), 'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  const exports = {} as { createAppStudySync: () => ReturnType<typeof journal.createStudySync> };
  const fail = async () => { throw new Error('isolated offline fixture'); };
  const dependencies: Record<string, unknown> = {
    '@/contracts/study-sync': journal, '@/lib/local-user-data-keys': keys,
    '@/lib/protected-storage': { protectedStorage },
    '@/lib/remote-user-data': { loadRemoteAnswers: fail, saveRemoteAnswer: fail, removeRemoteAnswer: fail },
  };
  vm.runInNewContext(compiled, { exports, require: (name: string) => dependencies[name] });
  const first = exports.createAppStudySync();
  await first.selectOwner('fixture-a'); await first.sync();
  first.answer({ questionId: 'q1', subject: 'Test', selected: 'B', isCorrect: true, answeredAt: '2026-09-03T12:00:00Z' });
  await first.flush(); await first.sync(); first.dispose();
  const restored = exports.createAppStudySync();
  await restored.selectOwner('fixture-a'); await restored.sync();
  assert.equal(restored.getState().ready, true);
  assert.equal(restored.getState().answers.q1.selected, 'B');
  assert.equal(restored.getState().pending, 1);
  await restored.selectOwner('fixture-b');
  assert.deepEqual(restored.getState().answers, {});
});
