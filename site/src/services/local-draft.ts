import type { Question } from '../types/domain.ts';
import { mapPublishedQuestions } from './published-content.ts';

type ObjectValue = Record<string, unknown>;
const object = (value: unknown): value is ObjectValue => value !== null && typeof value === 'object' && !Array.isArray(value);

export async function parseLocalDraft(manifestValue: unknown, jsonl: string): Promise<Question[]> {
  if (!object(manifestValue) || manifestValue.publicationStatus !== 'draft' || manifestValue.questions !== 10) {
    throw new Error('Manifesto do piloto inválido');
  }
  const files = manifestValue.files;
  const entry = Array.isArray(files) ? files.find(file => object(file) && file.path === 'questoes.jsonl') : null;
  if (!object(entry) || typeof entry.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(entry.sha256)) {
    throw new Error('Hash do pacote ausente');
  }
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(jsonl));
  const actual = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
  if (actual !== entry.sha256) throw new Error('Pacote local alterado');
  const lines = jsonl.trim().split(/\r?\n/);
  if (lines.length !== manifestValue.questions) throw new Error('Quantidade de questões divergente');
  const ids = new Set<string>();
  const records = lines.map(line => {
    const record: unknown = JSON.parse(line);
    if (!object(record) || record.schemaVersion !== 2 || record.kind !== 'question'
      || !object(record.data) || record.data.publicationStatus !== 'draft'
      || !object(record.source) || typeof record.source.url !== 'string'
      || !record.source.url.startsWith('https://') || typeof record.data.id !== 'string'
      || ids.has(record.data.id)) throw new Error('Registro draft inválido ou duplicado');
    ids.add(record.data.id);
    return record.data;
  });
  const questions = mapPublishedQuestions(records);
  if (questions.length !== lines.length) throw new Error('Questão incompleta no pacote local');
  return questions;
}

export async function loadLocalDraft(): Promise<Question[]> {
  const [manifestResponse, questionsResponse] = await Promise.all([
    fetch('/local-pilot/manifesto.json', { cache: 'no-store' }),
    fetch('/local-pilot/questoes.jsonl', { cache: 'no-store' }),
  ]);
  if (!manifestResponse.ok || !questionsResponse.ok) throw new Error('Pacote do piloto não encontrado');
  return parseLocalDraft(await manifestResponse.json(), await questionsResponse.text());
}
