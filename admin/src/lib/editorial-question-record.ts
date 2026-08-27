import type {
  AdminQuestion,
  EditorialExplanation,
  EditorialImportRecord,
  EditorialQuestionImportData,
} from '../types';

function explanationFrom(data: EditorialQuestionImportData): EditorialExplanation | undefined {
  if (typeof data.explanation === 'string') {
    return {
      text: data.explanation.trim(),
      origin: 'editorial',
      reviewStatus: 'reviewed',
    };
  }
  return data.explanation;
}

export function applyQuestionImport(
  record: EditorialImportRecord,
  existing?: AdminQuestion,
): AdminQuestion {
  if (record.kind !== 'question') throw new Error('O registro não é uma questão.');
  const data = record.data as EditorialQuestionImportData;
  const explanation = explanationFrom(data);
  return {
    ...existing,
    ...data,
    explanation: explanation?.text ?? existing?.explanation,
    explanationOrigin: explanation?.origin ?? existing?.explanationOrigin,
    explanationReviewStatus:
      explanation?.reviewStatus ?? existing?.explanationReviewStatus,
    explanationProvider: explanation?.provider ?? existing?.explanationProvider,
    explanationModel: explanation?.model ?? existing?.explanationModel,
    explanationPromptVersion:
      explanation?.promptVersion ?? existing?.explanationPromptVersion,
    publicationStatus: existing?.publicationStatus ?? 'draft',
    sourceProvider: record.source.provider,
    sourceExternalId: record.source.externalId,
    sourceUrl: record.source.url,
    sourceCollectedAt: record.source.collectedAt,
    updatedAt: existing?.updatedAt ?? record.source.collectedAt,
  };
}

export function importQuestionsLocally(
  records: EditorialImportRecord[],
  existing: Map<string, AdminQuestion> = new Map(),
): { catalog: Map<string, AdminQuestion>; created: number; updated: number } {
  const catalog = new Map(existing);
  let created = 0;
  let updated = 0;
  for (const record of records) {
    if (record.kind !== 'question') continue;
    const id = String(record.data.id);
    const current = catalog.get(id);
    catalog.set(id, applyQuestionImport(record, current));
    if (current) updated += 1;
    else created += 1;
  }
  return { catalog, created, updated };
}
