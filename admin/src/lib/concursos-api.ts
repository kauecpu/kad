import type { AdminConcurso } from '../types';
import { supabase } from './supabase';

function asConcursoList(value: unknown): AdminConcurso[] {
  if (!Array.isArray(value)) return [];
  return value as AdminConcurso[];
}

export async function loadAdminConcursos(): Promise<AdminConcurso[]> {
  if (!supabase) throw new Error('Supabase não configurado.');

  const { data, error } = await supabase.rpc('admin_list_concursos');
  if (error) throw error;
  return asConcursoList(data);
}

export async function saveAdminConcurso(concurso: AdminConcurso): Promise<void> {
  if (!supabase) throw new Error('Supabase não configurado.');

  const { error } = await supabase.rpc('admin_save_concurso', {
    p_concurso: concurso,
  });
  if (error) throw error;
}

export async function deleteAdminConcurso(concursoId: string): Promise<void> {
  if (!supabase) throw new Error('Supabase não configurado.');

  const { error } = await supabase.rpc('admin_delete_concurso', {
    p_concurso_id: concursoId,
  });
  if (error) throw error;
}
