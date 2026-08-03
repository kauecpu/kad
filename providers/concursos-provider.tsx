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
import { supabase } from '@/lib/supabase';
import type { Concurso, ConcursoRole, EducationLevel, Region } from '@/types';

type RemoteRole = {
  name: string;
  vacancies: number;
  salary: number | string;
  level: EducationLevel;
  sort_order: number;
};

type RemoteConcurso = {
  id: string;
  short_name: string;
  icon: string;
  icon_color: string;
  organ: string;
  title: string;
  board: string;
  state: string;
  city: string | null;
  region: Region;
  levels: EducationLevel[];
  vacancies: number;
  salary_min: number | string;
  salary_max: number | string;
  registration_start: string | null;
  registration_end: string | null;
  exam_date: string | null;
  fee: number | string | null;
  status: Concurso['status'];
  highlights: string[];
  edital_url: string;
  updated_at: string;
  concurso_roles: RemoteRole[];
};

type ConcursoContextValue = {
  concursos: Concurso[];
  loading: boolean;
  source: 'demo' | 'published';
  refresh: () => Promise<void>;
};

const ConcursoContext = createContext<ConcursoContextValue | null>(null);

function mapRemoteConcurso(row: RemoteConcurso): Concurso {
  const roles: ConcursoRole[] = [...(row.concurso_roles ?? [])]
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((role) => ({
      name: role.name,
      vacancies: role.vacancies,
      salary: Number(role.salary),
      level: role.level,
    }));

  return {
    id: row.id,
    shortName: row.short_name,
    icon: row.icon,
    iconColor: row.icon_color,
    organ: row.organ,
    title: row.title,
    board: row.board,
    state: row.state,
    city: row.city ?? undefined,
    region: row.region,
    levels: row.levels,
    vacancies: row.vacancies,
    salaryMin: Number(row.salary_min),
    salaryMax: Number(row.salary_max),
    registrationStart: row.registration_start ?? undefined,
    registrationEnd: row.registration_end ?? undefined,
    examDate: row.exam_date ?? undefined,
    fee: row.fee === null ? undefined : Number(row.fee),
    status: row.status,
    roles,
    highlights: row.highlights ?? [],
    editalUrl: row.edital_url,
    updatedAt: row.updated_at,
    contentSource: 'published',
  };
}

export function ConcursosProvider({ children }: { children: ReactNode }) {
  const [concursos, setConcursos] = useState<Concurso[]>(CONCURSOS);
  const [source, setSource] = useState<'demo' | 'published'>('demo');
  const [loading, setLoading] = useState(Boolean(supabase));

  const refresh = useCallback(async () => {
    if (!supabase) {
      setLoading(false);
      return;
    }

    setLoading(true);
    const { data, error } = await supabase
      .from('concursos')
      .select(`
        id, short_name, icon, icon_color, organ, title, board, state, city, region,
        levels, vacancies, salary_min, salary_max, registration_start, registration_end,
        exam_date, fee, status, highlights, edital_url, updated_at,
        concurso_roles (name, vacancies, salary, level, sort_order)
      `)
      .eq('publication_status', 'published')
      .order('updated_at', { ascending: false });

    if (!error && data && data.length > 0) {
      setConcursos((data as unknown as RemoteConcurso[]).map(mapRemoteConcurso));
      setSource('published');
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const value = useMemo(
    () => ({ concursos, loading, source, refresh }),
    [concursos, loading, refresh, source],
  );

  return <ConcursoContext.Provider value={value}>{children}</ConcursoContext.Provider>;
}

export function useConcursos(): ConcursoContextValue {
  const context = useContext(ConcursoContext);
  if (!context) throw new Error('useConcursos precisa ser usado dentro de ConcursosProvider.');
  return context;
}
