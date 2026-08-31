export type BackendState = {
  connection: 'offline' | 'connecting' | 'connected' | 'error';
  content: 'local' | 'unknown' | 'loading' | 'remote' | 'empty' | 'unavailable';
};

export type BackendStateInput = {
  configured: boolean;
  loading?: boolean;
  error?: string | null;
  loadedFromRemote?: boolean;
  questionCount?: number;
  concursoCount?: number;
};

export function isRemoteContentAuthoritative(input: Pick<BackendStateInput, 'configured' | 'loadedFromRemote'>): boolean {
  return input.configured && input.loadedFromRemote === true;
}

export function classifyBackendState(input: BackendStateInput): BackendState {
  if (!input.configured) return { connection: 'offline', content: 'local' };
  if (input.loading) return { connection: 'connecting', content: 'loading' };
  if (input.error) return { connection: 'error', content: 'unavailable' };
  if (!isRemoteContentAuthoritative(input)) return { connection: 'connected', content: 'unknown' };
  const empty = (input.questionCount ?? 0) === 0 && (input.concursoCount ?? 0) === 0;
  return { connection: 'connected', content: empty ? 'empty' : 'remote' };
}

export function backendStateMessage(state: BackendState): { label: string; description: string; tone: 'neutral' | 'success' | 'warning' | 'danger' } {
  if (state.connection === 'offline') {
    return { label: 'Modo visitante', description: 'Dados deste navegador. Entre em uma conta para sincronizar.', tone: 'warning' };
  }
  if (state.connection === 'connecting') {
    return { label: 'Conectando ao KAD', description: 'Validando o ambiente e carregando o conteúdo publicado.', tone: 'neutral' };
  }
  if (state.connection === 'error') {
    return { label: 'Conexão indisponível', description: 'O KAD não conseguiu confirmar os dados remotos. Tente novamente mais tarde.', tone: 'danger' };
  }
  if (state.content === 'empty') {
    return { label: 'Homologação conectada', description: 'O banco remoto está acessível, mas ainda não há conteúdo publicado neste ambiente.', tone: 'warning' };
  }
  if (state.content === 'remote') {
    return { label: 'Conteúdo do banco', description: 'Questões e concursos carregados do banco do KAD.', tone: 'success' };
  }
  return { label: 'Conectado', description: 'A conexão com o banco do KAD está ativa.', tone: 'success' };
}
