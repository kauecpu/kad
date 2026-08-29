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

import { QUESTIONS } from '@/data/questions';
import { mapPublishedQuestions } from '@/lib/published-content';
import { buildQuestionPacks } from '@/lib/question-catalog';
import { supabase } from '@/lib/supabase';
import type { ConcursoPack, Question } from '@/types';

const CACHE_KEY = '@kad/published-questions/v1';

export type PublishedContentSource = 'demo' | 'cache' | 'published';

type QuestionsContextValue = {
  questions: Question[];
  loading: boolean;
  error: string | null;
  source: PublishedContentSource;
  packs: ConcursoPack[];
  refresh: () => Promise<void>;
};

const QuestionsContext = createContext<QuestionsContextValue | null>(null);

export function QuestionsProvider({ children }: { children: ReactNode }) {
  const [questions, setQuestions] = useState<Question[]>(supabase ? [] : QUESTIONS);
  const [source, setSource] = useState<PublishedContentSource>('demo');
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
      .from('questions')
      .select(`
        id, discipline, subject, topic, board, year, role, institution, concurso,
        level, difficulty, statement, alternatives, correct, explanation
      `)
      .eq('publication_status', 'published')
      .order('updated_at', { ascending: false });

    if (requestError) {
      setError('Não foi possível atualizar as questões agora.');
      setLoading(false);
      return;
    }

    const published = mapPublishedQuestions(data);
    if (data && published.length !== data.length) {
      setError('Algumas questões publicadas foram ignoradas por estarem incompletas.');
    }
    setQuestions(published);
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
        const parsed = mapPublishedQuestions(JSON.parse(cached));
        if (parsed.length > 0) {
          setQuestions(parsed);
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
    () => ({
      questions,
      loading,
      error,
      source,
      packs: buildQuestionPacks(questions, source),
      refresh,
    }),
    [error, loading, questions, refresh, source],
  );

  return <QuestionsContext.Provider value={value}>{children}</QuestionsContext.Provider>;
}

export function useQuestions(): QuestionsContextValue {
  const context = useContext(QuestionsContext);
  if (!context) throw new Error('useQuestions precisa ser usado dentro de QuestionsProvider.');
  return context;
}
