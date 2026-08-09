import type { Session, User } from '@supabase/supabase-js';
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import { isPreviewMode, supabase } from '../lib/supabase';
import type { AdminAccess } from '../types';

type AuthContextValue = {
  access: AdminAccess | null;
  error: string | null;
  isPreview: boolean;
  loading: boolean;
  session: Session | null;
  user: User | null;
  signIn: (email: string, password: string) => Promise<boolean>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

const previewAccess: AdminAccess = {
  role: 'owner',
  permissions: [
    'dashboard.read',
    'content.read',
    'content.write',
    'content.publish',
    'community.read',
    'community.moderate',
    'users.read',
    'users.manage',
    'audit.read',
    'admins.manage',
  ],
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [access, setAccess] = useState<AdminAccess | null>(isPreviewMode ? previewAccess : null);
  const [loading, setLoading] = useState(!isPreviewMode);
  const [error, setError] = useState<string | null>(null);

  const loadAccess = useCallback(async (nextSession: Session | null) => {
    setSession(nextSession);
    setError(null);

    if (!nextSession || !supabase) {
      setAccess(null);
      setLoading(false);
      return false;
    }

    const { data, error: accessError } = await supabase.rpc('get_my_admin_access');
    if (accessError) {
      setAccess(null);
      setError('Não foi possível validar as permissões administrativas. Verifique a migration do painel.');
      setLoading(false);
      return false;
    }

    if (!data || typeof data !== 'object' || !('role' in data)) {
      setAccess(null);
      setError('Esta conta não possui acesso ao painel administrativo.');
      setLoading(false);
      return false;
    }

    setAccess(data as unknown as AdminAccess);
    setLoading(false);
    return true;
  }, []);

  useEffect(() => {
    if (isPreviewMode) return;

    if (!supabase) {
      setError('Configure as variáveis do Supabase para acessar o painel.');
      setLoading(false);
      return;
    }

    void supabase.auth.getSession().then(({ data }) => loadAccess(data.session));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      window.setTimeout(() => void loadAccess(nextSession), 0);
    });

    return () => listener.subscription.unsubscribe();
  }, [loadAccess]);

  const signIn = useCallback(
    async (email: string, password: string) => {
      if (!supabase) {
        setError('Configure as variáveis do Supabase antes de entrar.');
        return false;
      }

      setLoading(true);
      setError(null);
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (signInError) {
        setError('E-mail ou senha inválidos.');
        setLoading(false);
        return false;
      }

      const authorized = await loadAccess(data.session);
      if (!authorized) await supabase.auth.signOut();
      return authorized;
    },
    [loadAccess],
  );

  const signOut = useCallback(async () => {
    if (isPreviewMode) return;
    await supabase?.auth.signOut({ scope: 'local' });
    setSession(null);
    setAccess(null);
    setError(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      access,
      error,
      isPreview: isPreviewMode,
      loading,
      session,
      user: session?.user ?? null,
      signIn,
      signOut,
    }),
    [access, error, loading, session, signIn, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
}
