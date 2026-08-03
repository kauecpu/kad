import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

import { EMPTY_SEARCH } from '@/lib/search';
import type { QuestionSearch } from '@/types';

type SearchContextValue = {
  search: QuestionSearch;
  setSearch: (search: QuestionSearch) => void;
  update: (patch: Partial<QuestionSearch>) => void;
  reset: () => void;
};

const SearchContext = createContext<SearchContextValue | null>(null);

/**
 * Guarda o estado da tela "Procurar questões" em memória, para que os filtros sejam
 * preservados ao navegar para os resultados e voltar. Fica isolado do AppProvider para
 * não re-renderizar o restante do aplicativo a cada mudança de filtro.
 */
export function SearchProvider({ children }: { children: ReactNode }) {
  const [search, setSearch] = useState<QuestionSearch>(EMPTY_SEARCH);

  const value = useMemo<SearchContextValue>(
    () => ({
      search,
      setSearch,
      update: (patch) => setSearch((current) => ({ ...current, ...patch })),
      reset: () => setSearch(EMPTY_SEARCH),
    }),
    [search]
  );

  return <SearchContext.Provider value={value}>{children}</SearchContext.Provider>;
}

export function useSearch(): SearchContextValue {
  const context = useContext(SearchContext);
  if (!context) {
    throw new Error('useSearch deve ser usado dentro de SearchProvider');
  }
  return context;
}
