import type { RankingPeriod } from '@/data/ranking';
import { parseRankingSnapshot, type RankingSnapshot } from '@/lib/ranking';
import { supabase } from '@/lib/supabase';

export async function loadRanking(period: RankingPeriod, offset = 0): Promise<RankingSnapshot> {
  if (!supabase) throw new Error('Conecte o Supabase para carregar o ranking.');
  const { data, error } = await supabase.rpc('get_ranking', { p_period: period, p_limit: 100, p_offset: offset });
  if (error) throw error;
  return parseRankingSnapshot(data);
}

export async function updateRankingOptIn(enabled: boolean): Promise<boolean> {
  if (!supabase) throw new Error('Conecte o Supabase para alterar sua participação.');
  const { data, error } = await supabase.rpc('set_ranking_opt_in', { p_enabled: enabled });
  if (error) throw error;
  if (typeof data !== 'boolean') throw new Error('Não foi possível confirmar a preferência do ranking.');
  return data;
}
