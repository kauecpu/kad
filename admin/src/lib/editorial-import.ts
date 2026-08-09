import type { EditorialImportRecord } from '../types';

export type ImportParseIssue = { line: number; message: string };
export type ImportParseResult = {
  records: EditorialImportRecord[];
  issues: ImportParseIssue[];
};

const MAX_RECORDS = 500;

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function validateRecord(value: unknown, line: number): ImportParseIssue[] {
  const issues: ImportParseIssue[] = [];
  if (!isObject(value)) return [{ line, message: 'O registro deve ser um objeto JSON.' }];
  if (value.schemaVersion !== 1) issues.push({ line, message: 'schemaVersion deve ser 1.' });
  if (value.kind !== 'concurso' && value.kind !== 'question') {
    issues.push({ line, message: 'kind deve ser concurso ou question.' });
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
    if (typeof value.source.url !== 'string' || !value.source.url.startsWith('https://')) {
      issues.push({ line, message: 'source.url deve usar HTTPS.' });
    }
    if (typeof value.source.collectedAt !== 'string' || Number.isNaN(Date.parse(value.source.collectedAt))) {
      issues.push({ line, message: 'source.collectedAt deve ser uma data ISO válida.' });
    }
  }
  if (!isObject(value.data) || typeof value.data.id !== 'string' || !/^[a-z0-9][a-z0-9-]{2,119}$/.test(value.data.id)) {
    issues.push({ line, message: 'data.id é obrigatório e deve ser um slug.' });
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
  return {
    records: issues.length ? [] : parsed.slice(0, MAX_RECORDS).map((item) => item.value as EditorialImportRecord),
    issues,
  };
}
