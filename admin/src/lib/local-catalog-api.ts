import {
  buildInitialCatalogImportRecords,
  buildInitialCatalogSeed,
} from '../../../lib/editorial-seed';
import type { AdminConcurso, AdminQuestion, EditorialImportRecord } from '../types';
import { saveAdminConcurso } from './concursos-api';
import {
  applyImportBatch,
  createImportBatch,
  loadImportBatch,
  setImportDecision,
} from './imports-api';
import { saveAdminQuestion } from './questions-api';

export type CatalogPublishProgress = {
  completed: number;
  total: number;
  label: string;
};

export async function publishInitialCatalog(
  onProgress?: (progress: CatalogPublishProgress) => void,
): Promise<{ concursos: number; questions: number }> {
  const seed = buildInitialCatalogSeed();
  const records = buildInitialCatalogImportRecords();
  const total = seed.concursos.length + seed.questions.length;
  let completed = 0;

  const batchId = await createImportBatch(
    `kad-acervo-inicial-${new Date().toISOString().slice(0, 10)}.json`,
    records as EditorialImportRecord[],
  );
  const detail = await loadImportBatch(batchId);
  if (detail.invalidCount > 0) {
    throw new Error('O lote inicial contém registros inválidos.');
  }
  for (const item of detail.items.filter((entry) => entry.status === 'duplicate')) {
    await setImportDecision(item.id, 'upsert');
  }
  const imported = await applyImportBatch(batchId);
  if (imported.failed > 0 || imported.imported !== total) {
    throw new Error('O staging não conseguiu importar todo o acervo inicial.');
  }

  for (const concurso of seed.concursos) {
    await saveAdminConcurso(concurso as unknown as AdminConcurso);
    completed += 1;
    onProgress?.({ completed, total, label: String(concurso.title ?? concurso.id) });
  }

  for (const question of seed.questions) {
    await saveAdminQuestion(question as unknown as AdminQuestion);
    completed += 1;
    onProgress?.({ completed, total, label: String(question.id) });
  }

  return { concursos: seed.concursos.length, questions: seed.questions.length };
}
