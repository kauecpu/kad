import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import { CONCURSOS } from '@/data/concursos';
import { mapPublishedConcursos } from '@/lib/published-content';
import { supabase } from '@/lib/supabase';
import type { Concurso } from '@/types';

const CACHE_KEY = '@kad/published-concursos/v1';

type ContentSource = 'demo' | 'cache' | 'published';

type ConcursoContextValue = {
  concursos: Concurso[];
  loading: boolean;
  error: string | null;
  source: ContentSource;
  refresh: () => Promise<void>;
};

const ConcursoContext = createContext<ConcursoContextValue | null>(null);

export function ConcursosProvider({ children }: { children: ReactNode }) {
  const [concursos, setConcursos] = useState<Concurso[]>(supabase ? [] : CONCURSOS);
  const [source, setSource] = useState<ContentSource>('demo');
  const [loading, setLoading] = useState(Boolean(supabase));
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!supabase) {
      setLoading(false);
      setError('O conteúdo online não está configurado neste ambiente.');
      return;
    }

    setLoading(true);
    setError(null);
    const { data, error: requestError } = await supabase
      .from('concursos')
      .select(`
        id, short_name, icon, icon_color, organ, title, board, state, city, region,
        levels, vacancies, salary_min, salary_max, registration_start, registration_end,
        exam_date, fee, status, highlights, edital_url, updated_at, source_provider,
        concurso_roles (name, vacancies, salary, level, sort_order)
      `)
      .eq('publication_status', 'published')
      .order('updated_at', { ascending: false });

    if (requestError) {
      setError('Não foi possível atualizar os concursos agora.');
      setLoading(false);
      return;
    }

    const published = mapPublishedConcursos(data);
    if (data && published.length !== data.length) {
      setError('Alguns concursos publicados foram ignorados por estarem incompletos.');
    }
    setConcursos(published);
    setSource('published');
    if (published.length > 0) {
      await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(published)).catch(() => {});
    } else {
      await AsyncStorage.removeItem(CACHE_KEY).catch(() => {});
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    let active = true;
    AsyncStorage.getItem(CACHE_KEY)
      .then((cached) => {
        if (!active || !cached) return;
        const parsed = JSON.parse(cached) as Concurso[];
        if (Array.isArray(parsed) && parsed.length > 0) {
          setConcursos(parsed);
          setSource('cache');
        }
      })
      .catch(() => {})
      .finally(() => {
        if (active) void refresh();
      });
    return () => {
      active = false;
    };
  }, [refresh]);

  const value = useMemo(
    () => ({ concursos, loading, error, source, refresh }),
    [concursos, error, loading, refresh, source],
  );

  return <ConcursoContext.Provider value={value}>{children}</ConcursoContext.Provider>;
}

export function useConcursos(): ConcursoContextValue {
  const context = useContext(ConcursoContext);
  if (!context) throw new Error('useConcursos precisa ser usado dentro de ConcursosProvider.');
  return context;
}
