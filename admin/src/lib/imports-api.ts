import type { AdminImportBatch, AdminImportBatchDetail, EditorialImportRecord, ImportDecision } from '../types';
import { supabase } from './supabase';

function requireSupabase() {
  if (!supabase) throw new Error('Supabase não configurado.');
  return supabase;
}

export async function createImportBatch(filename: string, records: EditorialImportRecord[]): Promise<string> {
  const { data, error } = await requireSupabase().rpc('admin_create_import_batch', {
    p_filename: filename,
    p_records: records,
  });
  if (error) throw error;
  return data as string;
}

export async function loadImportBatches(): Promise<AdminImportBatch[]> {
  const { data, error } = await requireSupabase().rpc('admin_list_import_batches');
  if (error) throw error;
  return Array.isArray(data) ? data as AdminImportBatch[] : [];
}

export async function loadImportBatch(id: string): Promise<AdminImportBatchDetail> {
  const { data, error } = await requireSupabase().rpc('admin_get_import_batch', { p_batch_id: id });
  if (error) throw error;
  return data as AdminImportBatchDetail;
}

export async function setImportDecision(itemId: string, decision: ImportDecision): Promise<void> {
  const { error } = await requireSupabase().rpc('admin_set_import_item_decision', {
    p_item_id: itemId,
    p_decision: decision,
  });
  if (error) throw error;
}

export async function updateImportItem(itemId: string, record: EditorialImportRecord): Promise<void> {
  const { error } = await requireSupabase().rpc('admin_update_import_item', {
    p_item_id: itemId,
    p_record: record,
  });
  if (error) throw error;
}

export async function applyImportBatch(id: string): Promise<{ imported: number; skipped: number; failed: number }> {
  const { data, error } = await requireSupabase().rpc('admin_apply_import_batch', { p_batch_id: id });
  if (error) throw error;
  return data as { imported: number; skipped: number; failed: number };
}

export async function rollbackImportBatch(id: string): Promise<{ rolledBack: number; blocked: number }> {
  const { data, error } = await requireSupabase().rpc('admin_rollback_import_batch', { p_batch_id: id });
  if (error) throw error;
  return data as { rolledBack: number; blocked: number };
}
