import type { EditorialImportRecord } from '../types';

export type ImportParseIssue = { line: number; message: string };
export type ImportParseResult = {
  records: EditorialImportRecord[];
  issues: ImportParseIssue[];
};

const MAX_RECORDS = 5_000;
const QUESTION_TEXT_FIELDS = [
  'discipline', 'subject', 'topic', 'board', 'role', 'institution', 'concurso',
] as const;
const ALTERNATIVE_IDS = ['A', 'B', 'C', 'D', 'E'] as const;

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasText(value: unknown, minimum = 2): value is string {
  return typeof value === 'string' && value.trim().length >= minimum;
}

function isHttpsUrl(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && Boolean(url.hostname) && !url.username && !url.password;
  } catch {
    return false;
  }
}

function validateExplanation(
  data: Record<string, unknown>,
  schemaVersion: 1 | 2,
  line: number,
): ImportParseIssue[] {
  const explanation = data.explanation;
  if (schemaVersion === 1) {
    return hasText(explanation, 10)
      ? []
      : [{ line, message: 'data.explanation deve ter ao menos 10 caracteres no contrato v1.' }];
  }
  if (explanation === undefined || explanation === null) return [];
  if (!isObject(explanation)) {
    return [{ line, message: 'data.explanation deve ser um objeto no contrato v2.' }];
  }
  const issues: ImportParseIssue[] = [];
  if (!hasText(explanation.text, 10)) {
    issues.push({ line, message: 'data.explanation.text deve ter ao menos 10 caracteres.' });
  }
  if (!['official', 'editorial', 'ai'].includes(String(explanation.origin))) {
    issues.push({ line, message: 'data.explanation.origin é inválida.' });
  }
  if (!['draft', 'reviewed'].includes(String(explanation.reviewStatus))) {
    issues.push({ line, message: 'data.explanation.reviewStatus é inválido.' });
  }
  if (explanation.origin === 'ai') {
    for (const field of ['provider', 'model', 'promptVersion'] as const) {
      if (!hasText(explanation[field], 1)) {
        issues.push({ line, message: `data.explanation.${field} é obrigatório para conteúdo de IA.` });
      }
    }
  }
  return issues;
}

function validateQuestionData(
  data: Record<string, unknown>,
  schemaVersion: 1 | 2,
  line: number,
): ImportParseIssue[] {
  const issues: ImportParseIssue[] = [];
  for (const field of QUESTION_TEXT_FIELDS) {
    if (!hasText(data[field])) issues.push({ line, message: `data.${field} é obrigatório.` });
  }
  if (!Number.isInteger(data.year) || (data.year as number) < 1900 || (data.year as number) > 2100) {
    issues.push({ line, message: 'data.year deve ser um ano válido.' });
  }
  if (!['Fundamental', 'Médio', 'Superior'].includes(String(data.level))) {
    issues.push({ line, message: 'data.level é inválido.' });
  }
  if (data.difficulty !== undefined && !['Fácil', 'Média', 'Difícil'].includes(String(data.difficulty))) {
    issues.push({ line, message: 'data.difficulty é inválida.' });
  }
  if (!hasText(data.statement, 10)) issues.push({ line, message: 'data.statement deve ter ao menos 10 caracteres.' });
  issues.push(...validateExplanation(data, schemaVersion, line));
  if (data.publicationStatus !== 'draft') {
    issues.push({ line, message: 'data.publicationStatus deve ser draft; a importação nunca publica automaticamente.' });
  }

  const alternatives = data.alternatives;
  if (!Array.isArray(alternatives) || alternatives.length < 2 || alternatives.length > 5) {
    issues.push({ line, message: 'data.alternatives deve possuir de 2 a 5 opções.' });
    return issues;
  }
  const ids: string[] = [];
  alternatives.forEach((alternative, index) => {
    if (!isObject(alternative)) {
      issues.push({ line, message: `data.alternatives[${index}] deve ser um objeto.` });
      return;
    }
    if (alternative.id !== ALTERNATIVE_IDS[index]) {
      issues.push({ line, message: `data.alternatives deve ser sequencial de A até ${ALTERNATIVE_IDS[alternatives.length - 1]}.` });
    }
    if (!hasText(alternative.text, 1)) {
      issues.push({ line, message: `data.alternatives[${index}].text é obrigatório.` });
    }
    if (typeof alternative.id === 'string') ids.push(alternative.id);
  });
  if (new Set(ids).size !== ids.length) issues.push({ line, message: 'data.alternatives possui letras duplicadas.' });
  if (!ALTERNATIVE_IDS.includes(data.correct as typeof ALTERNATIVE_IDS[number]) || !ids.includes(String(data.correct))) {
    issues.push({ line, message: 'data.correct não corresponde a uma alternativa válida.' });
  }
  return issues;
}

function validateRecord(value: unknown, line: number): ImportParseIssue[] {
  const issues: ImportParseIssue[] = [];
  if (!isObject(value)) return [{ line, message: 'O registro deve ser um objeto JSON.' }];
  if (value.schemaVersion !== 1 && value.schemaVersion !== 2) {
    issues.push({ line, message: 'schemaVersion deve ser 1 ou 2.' });
  }
  if (value.kind !== 'concurso' && value.kind !== 'question') {
    issues.push({ line, message: 'kind deve ser concurso ou question.' });
  }
  if (value.schemaVersion === 2 && value.kind !== 'question') {
    issues.push({ line, message: 'O contrato v2 aceita somente registros de questão.' });
  }
  if (!isObject(value.source)) {
    issues.push({ line, message: 'source é obrigatório.' });
  } else {
    if (typeof value.source.provider !== 'string' || value.source.provider.trim().length < 2) {
      issues.push({ line, message: 'source.provider é obrigatório.' });
    }
    if (typeof value.source.externalId !== 'string' || !value.source.externalId.trim()) {
      issues.push({ line, message: 'source.externalId é obrigatório.' });
    }
    if (!isHttpsUrl(value.source.url)) {
      issues.push({ line, message: 'source.url deve usar HTTPS.' });
    }
    if (typeof value.source.collectedAt !== 'string' || Number.isNaN(Date.parse(value.source.collectedAt))) {
      issues.push({ line, message: 'source.collectedAt deve ser uma data ISO válida.' });
    }
    if (value.kind === 'question' && (typeof value.source.fingerprint !== 'string' || !/^[a-f0-9]{64}$/.test(value.source.fingerprint))) {
      issues.push({ line, message: 'source.fingerprint deve ser um SHA-256 para questões.' });
    }
  }
  if (!isObject(value.data) || typeof value.data.id !== 'string' || !/^[a-z0-9][a-z0-9-]{2,119}$/.test(value.data.id)) {
    issues.push({ line, message: 'data.id é obrigatório e deve ser um slug.' });
  } else if (value.kind === 'question' && (value.schemaVersion === 1 || value.schemaVersion === 2)) {
    issues.push(...validateQuestionData(value.data, value.schemaVersion, line));
  }
  return issues;
}

export function parseEditorialImport(text: string): ImportParseResult {
  const trimmed = text.trim();
  if (!trimmed) return { records: [], issues: [{ line: 1, message: 'O arquivo está vazio.' }] };

  const parsed: { value: unknown; line: number }[] = [];
  const issues: ImportParseIssue[] = [];

  if (trimmed.startsWith('[')) {
    try {
      const value: unknown = JSON.parse(trimmed);
      if (!Array.isArray(value)) throw new Error('O JSON deve conter uma lista.');
      value.forEach((record, index) => parsed.push({ value: record, line: index + 1 }));
    } catch (error) {
      return { records: [], issues: [{ line: 1, message: error instanceof Error ? error.message : 'JSON inválido.' }] };
    }
  } else {
    text.split(/\r?\n/).forEach((raw, index) => {
      if (!raw.trim()) return;
      try {
        parsed.push({ value: JSON.parse(raw), line: index + 1 });
      } catch {
        issues.push({ line: index + 1, message: 'Linha JSON inválida.' });
      }
    });
  }

  if (parsed.length > MAX_RECORDS) {
    issues.push({ line: 1, message: `O limite é de ${MAX_RECORDS} registros por lote.` });
  }

  for (const item of parsed) issues.push(...validateRecord(item.value, item.line));
  const seenIds = new Set<string>();
  const seenSources = new Set<string>();
  const seenFingerprints = new Set<string>();
  for (const item of parsed) {
    if (!isObject(item.value) || !isObject(item.value.data) || !isObject(item.value.source)) continue;
    const idKey = `${String(item.value.kind)}:${String(item.value.data.id)}`;
    const sourceKey = `${String(item.value.source.provider)}:${String(item.value.source.externalId)}`;
    const fingerprint = item.value.source.fingerprint;
    if (seenIds.has(idKey)) issues.push({ line: item.line, message: 'data.id duplicado no arquivo.' });
    if (seenSources.has(sourceKey)) issues.push({ line: item.line, message: 'Origem provider/externalId duplicada no arquivo.' });
    if (typeof fingerprint === 'string' && seenFingerprints.has(fingerprint)) {
      issues.push({ line: item.line, message: 'source.fingerprint duplicado no arquivo.' });
    }
    seenIds.add(idKey);
    seenSources.add(sourceKey);
    if (typeof fingerprint === 'string') seenFingerprints.add(fingerprint);
  }
  return {
    records: issues.length ? [] : parsed.slice(0, MAX_RECORDS).map((item) => item.value as EditorialImportRecord),
    issues,
  };
}
