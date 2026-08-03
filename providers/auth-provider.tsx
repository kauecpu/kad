import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Session, User } from '@supabase/supabase-js';
import * as Linking from 'expo-linking';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { AppState, Platform } from 'react-native';

import { authErrorMessage } from '@/lib/auth-errors';
import { authCodeFromUrl } from '@/lib/auth-security';
import { normalizeUsername } from '@/lib/profile';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';

const GUEST_STORAGE_KEY = '@kad/auth/guest-mode/v1';

type AuthActionResult = {
  ok: boolean;
  message?: string;
  requiresEmailConfirmation?: boolean;
};

type AuthContextValue = {
  session: Session | null;
  user: User | null;
  isLoading: boolean;
  isGuest: boolean;
  isConfigured: boolean;
  canAccessApp: boolean;
  recoveryReady: boolean;
  linkError?: string;
  signIn: (email: string, password: string) => Promise<AuthActionResult>;
  signUp: (
    name: string,
    username: string,
    email: string,
    password: string
  ) => Promise<AuthActionResult>;
  signOut: () => Promise<AuthActionResult>;
  continueAsGuest: () => Promise<void>;
  sendPasswordReset: (email: string) => Promise<AuthActionResult>;
  updatePassword: (password: string, currentPassword?: string) => Promise<AuthActionResult>;
  deleteRemoteAccount: (currentPassword: string) => Promise<AuthActionResult>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function missingConfiguration(): AuthActionResult {
  return {
    ok: false,
    message: 'Conecte o projeto ao Supabase para usar cadastro e login.',
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [isGuest, setIsGuest] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [recoveryReady, setRecoveryReady] = useState(false);
  const [linkError, setLinkError] = useState<string>();

  useEffect(() => {
    let active = true;

    Promise.all([
      supabase?.auth.getSession() ?? Promise.resolve({ data: { session: null }, error: null }),
      AsyncStorage.getItem(GUEST_STORAGE_KEY),
    ])
      .then(([authResult, guestValue]) => {
        if (!active) return;
        setSession(authResult.data.session);
        setIsGuest(guestValue === 'true' && !authResult.data.session);
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    const authSubscription = supabase?.auth.onAuthStateChange((event, nextSession) => {
      setSession(nextSession);
      if (event === 'PASSWORD_RECOVERY') setRecoveryReady(true);
      if (nextSession) {
        setIsGuest(false);
        AsyncStorage.removeItem(GUEST_STORAGE_KEY).catch(() => {});
      }
    });

    return () => {
      active = false;
      authSubscription?.data.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    const client = supabase;
    if (!client || Platform.OS === 'web') return;
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') client.auth.startAutoRefresh();
      else client.auth.stopAutoRefresh();
    });
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    const client = supabase;
    if (!client) return;

    const handleUrl = async (url: string | null) => {
      if (!url) return;
      const { callback, code, errorDescription } = authCodeFromUrl(url);
      if (!callback) return;
      setLinkError(undefined);
      if (errorDescription) {
        setLinkError('Este link expirou ou já foi utilizado. Solicite um novo e-mail.');
        return;
      }
      if (!code) {
        setLinkError('Este link não é válido. Solicite um novo e-mail.');
        return;
      }

      const { data, error } = await client.auth.exchangeCodeForSession(code);
      if (error || !data.session) {
        throw error ?? new Error('Auth session was not established');
      }
      if (callback === 'recovery') {
        setRecoveryReady(true);
      }
    };

    const handleLinkError = () => {
      setLinkError('Não foi possível validar este link. Solicite um novo e-mail.');
    };
    Linking.getInitialURL().then(handleUrl).catch(handleLinkError);
    const subscription = Linking.addEventListener('url', ({ url }) => {
      handleUrl(url).catch(handleLinkError);
    });
    return () => subscription.remove();
  }, []);

  const signIn = useCallback(async (email: string, password: string): Promise<AuthActionResult> => {
    if (!supabase) return missingConfiguration();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return error ? { ok: false, message: authErrorMessage(error) } : { ok: true };
  }, []);

  const signUp = useCallback(
    async (
      name: string,
      username: string,
      email: string,
      password: string
    ): Promise<AuthActionResult> => {
      if (!supabase) return missingConfiguration();
      const normalizedUsername = normalizeUsername(username);
      const { data: usernameAvailable, error: usernameError } = await supabase.rpc(
        'is_username_available',
        { candidate_username: normalizedUsername }
      );
      if (usernameError) {
        return {
          ok: false,
          message: 'Não foi possível verificar esse usuário. Tente novamente em instantes.',
        };
      }
      if (!usernameAvailable) {
        return { ok: false, message: 'Este usuário já está em uso.' };
      }
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { name, username: normalizedUsername },
          emailRedirectTo: Linking.createURL('auth/login'),
        },
      });
      if (error) {
        if (error.message.toLocaleLowerCase('en-US').includes('username')) {
          return { ok: false, message: 'Este usuário já está em uso.' };
        }
        return { ok: false, message: authErrorMessage(error) };
      }
      return { ok: true, requiresEmailConfirmation: !data.session };
    },
    []
  );

  const signOut = useCallback(async (): Promise<AuthActionResult> => {
    if (!supabase) {
      setIsGuest(false);
      await AsyncStorage.removeItem(GUEST_STORAGE_KEY);
      return { ok: true };
    }
    const { error } = await supabase.auth.signOut();
    if (error) return { ok: false, message: authErrorMessage(error) };
    setIsGuest(false);
    setRecoveryReady(false);
    await AsyncStorage.removeItem(GUEST_STORAGE_KEY);
    return { ok: true };
  }, []);

  const continueAsGuest = useCallback(async () => {
    setIsGuest(true);
    await AsyncStorage.setItem(GUEST_STORAGE_KEY, 'true');
  }, []);

  const sendPasswordReset = useCallback(async (email: string): Promise<AuthActionResult> => {
    if (!supabase) return missingConfiguration();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: Linking.createURL('auth/nova-senha'),
    });
    return error ? { ok: false, message: authErrorMessage(error) } : { ok: true };
  }, []);

  const updatePassword = useCallback(async (
    password: string,
    currentPassword?: string
  ): Promise<AuthActionResult> => {
    if (!supabase) return missingConfiguration();
    if (currentPassword) {
      if (!session?.user.email) {
        return { ok: false, message: 'Entre novamente para alterar sua senha.' };
      }
      const { data: reauthenticated, error: reauthenticationError } =
        await supabase.auth.signInWithPassword({
          email: session.user.email,
          password: currentPassword,
        });
      if (reauthenticationError || reauthenticated.user?.id !== session.user.id) {
        return { ok: false, message: 'Senha atual incorreta.' };
      }
    }

    const { error } = await supabase.auth.updateUser({
      password,
      ...(currentPassword ? { current_password: currentPassword } : {}),
    });
    if (error) return { ok: false, message: authErrorMessage(error) };

    await supabase.auth.signOut({ scope: 'others' });
    setRecoveryReady(false);
    return { ok: true };
  }, [session]);

  const deleteRemoteAccount = useCallback(async (
    currentPassword: string
  ): Promise<AuthActionResult> => {
    if (!supabase || !session?.user.email) {
      return { ok: false, message: 'Entre novamente para excluir sua conta.' };
    }

    const { data: reauthenticated, error: reauthenticationError } =
      await supabase.auth.signInWithPassword({
        email: session.user.email,
        password: currentPassword,
      });
    if (reauthenticationError || reauthenticated.user?.id !== session.user.id) {
      return { ok: false, message: 'Senha atual incorreta.' };
    }

    const { error } = await supabase.functions.invoke('delete-account', {
      body: { currentPassword },
    });
    if (error) return { ok: false, message: authErrorMessage(error) };
    await supabase.auth.signOut({ scope: 'local' });
    setSession(null);
    return { ok: true };
  }, [session]);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user: session?.user ?? null,
      isLoading,
      isGuest,
      isConfigured: isSupabaseConfigured,
      canAccessApp: isGuest || Boolean(session),
      recoveryReady,
      linkError,
      signIn,
      signUp,
      signOut,
      continueAsGuest,
      sendPasswordReset,
      updatePassword,
      deleteRemoteAccount,
    }),
    [
      session,
      isLoading,
      isGuest,
      recoveryReady,
      linkError,
      signIn,
      signUp,
      signOut,
      continueAsGuest,
      sendPasswordReset,
      updatePassword,
      deleteRemoteAccount,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth precisa ser usado dentro de AuthProvider.');
  return context;
}
