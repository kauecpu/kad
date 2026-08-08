import AsyncStorage from '@react-native-async-storage/async-storage';
import { FunctionsHttpError, type Session, type User } from '@supabase/supabase-js';
import * as Linking from 'expo-linking';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { AppState, Platform } from 'react-native';

import { authErrorMessage } from '@/lib/auth-errors';
import {
  EMAIL_OTP_LENGTH,
  authCodeFromUrl,
  isAuthCallbackUrl,
  isValidEmailOtp,
  normalizeEmailOtp,
} from '@/lib/auth-security';
import { normalizeUsername } from '@/lib/profile';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';

const GUEST_STORAGE_KEY = '@kad/auth/guest-mode/v1';
const LEGACY_PENDING_VERIFICATION_EMAIL_STORAGE_KEY =
  '@kad/auth/pending-verification-email/v1';

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
  authLinkChecking: boolean;
  pendingVerificationEmail?: string;
  linkError?: string;
  signIn: (email: string, password: string) => Promise<AuthActionResult>;
  signUp: (
    name: string,
    username: string,
    email: string,
    password: string
  ) => Promise<AuthActionResult>;
  signOut: () => Promise<AuthActionResult>;
  continueAsGuest: () => Promise<AuthActionResult>;
  sendPasswordReset: (email: string) => Promise<AuthActionResult>;
  verifyEmailCode: (email: string, code: string) => Promise<AuthActionResult>;
  resendEmailConfirmation: (email: string) => Promise<AuthActionResult>;
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
  const [authLinkChecking, setAuthLinkChecking] = useState(true);
  const [pendingVerificationEmail, setPendingVerificationEmail] = useState<string>();
  const [linkError, setLinkError] = useState<string>();
  const processedAuthLinks = useRef(new Set<string>());

  const rememberPendingVerificationEmail = useCallback((email?: string) => {
    const nextEmail = email?.trim();
    setPendingVerificationEmail(nextEmail || undefined);
  }, []);

  useEffect(() => {
    let active = true;

    Promise.all([
      supabase?.auth.getSession() ?? Promise.resolve({ data: { session: null }, error: null }),
      AsyncStorage.getItem(GUEST_STORAGE_KEY),
      AsyncStorage.removeItem(LEGACY_PENDING_VERIFICATION_EMAIL_STORAGE_KEY),
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
      if (event === 'PASSWORD_RECOVERY') {
        setRecoveryReady(true);
        setAuthLinkChecking(false);
      }
      if (nextSession) {
        setIsGuest(false);
        setPendingVerificationEmail(undefined);
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
    if (AppState.currentState === 'active') client.auth.startAutoRefresh();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') client.auth.startAutoRefresh();
      else client.auth.stopAutoRefresh();
    });
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    const client = supabase;
    if (!client) {
      setAuthLinkChecking(false);
      return;
    }

    const handleUrl = async (url: string | null) => {
      if (!url) return false;
      if (!isAuthCallbackUrl(url)) return false;
      const { callback, code, errorDescription } = authCodeFromUrl(url);
      if (!callback) return false;
      if (processedAuthLinks.current.has(url)) return true;
      processedAuthLinks.current.add(url);
      setAuthLinkChecking(true);
      setLinkError(undefined);
      if (callback === 'recovery') setRecoveryReady(false);
      if (errorDescription) {
        setLinkError('Este link expirou ou já foi utilizado. Solicite um novo e-mail.');
        setAuthLinkChecking(false);
        return true;
      }
      if (!code) {
        setLinkError('Este link não é válido. Solicite um novo e-mail.');
        setAuthLinkChecking(false);
        return true;
      }

      const { data, error } = await client.auth.exchangeCodeForSession(code);
      if (error || !data.session) {
        processedAuthLinks.current.delete(url);
        setLinkError('Este link expirou ou já foi utilizado. Solicite um novo e-mail.');
        setAuthLinkChecking(false);
        return true;
      }
      if (callback === 'recovery') {
        setRecoveryReady(true);
      }
      setAuthLinkChecking(false);
      return true;
    };

    const handleLinkError = () => {
      setLinkError('Não foi possível validar este link. Solicite um novo e-mail.');
      setAuthLinkChecking(false);
    };
    Linking.getInitialURL()
      .then(async (url) => {
        const handled = await handleUrl(url);
        if (!handled) setAuthLinkChecking(false);
      })
      .catch(handleLinkError);
    const subscription = Linking.addEventListener('url', ({ url }) => {
      handleUrl(url).catch(handleLinkError);
    });
    return () => subscription.remove();
  }, []);

  const signIn = useCallback(async (email: string, password: string): Promise<AuthActionResult> => {
    if (!supabase) return missingConfiguration();
    setLinkError(undefined);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error?.code === 'email_not_confirmed') {
      rememberPendingVerificationEmail(email);
    } else if (!error) {
      rememberPendingVerificationEmail();
    }
    return error
      ? {
          ok: false,
          message: authErrorMessage(error),
          requiresEmailConfirmation: error.code === 'email_not_confirmed',
        }
      : { ok: true };
  }, [rememberPendingVerificationEmail]);

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
      if (!data.session) rememberPendingVerificationEmail(email);
      else rememberPendingVerificationEmail();
      return { ok: true, requiresEmailConfirmation: !data.session };
    },
    [rememberPendingVerificationEmail]
  );

  const signOut = useCallback(async (): Promise<AuthActionResult> => {
    if (!supabase) {
      setIsGuest(false);
      setPendingVerificationEmail(undefined);
      await AsyncStorage.removeItem(GUEST_STORAGE_KEY);
      return { ok: true };
    }
    const { error } = await supabase.auth.signOut({ scope: 'local' });
    if (error) return { ok: false, message: authErrorMessage(error) };
    setIsGuest(false);
    setRecoveryReady(false);
    setPendingVerificationEmail(undefined);
    await AsyncStorage.removeItem(GUEST_STORAGE_KEY);
    return { ok: true };
  }, []);

  const continueAsGuest = useCallback(async (): Promise<AuthActionResult> => {
    if (session && supabase) {
      const { error } = await supabase.auth.signOut({ scope: 'local' });
      if (error) return { ok: false, message: authErrorMessage(error) };
      setSession(null);
    }

    try {
      await AsyncStorage.setItem(GUEST_STORAGE_KEY, 'true');
      setIsGuest(true);
      setRecoveryReady(false);
      setPendingVerificationEmail(undefined);
      return { ok: true };
    } catch {
      setIsGuest(false);
      return {
        ok: false,
        message: 'Não foi possível iniciar o modo visitante. Tente novamente.',
      };
    }
  }, [session]);

  const sendPasswordReset = useCallback(async (email: string): Promise<AuthActionResult> => {
    if (!supabase) return missingConfiguration();
    setLinkError(undefined);
    setRecoveryReady(false);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: Linking.createURL('auth/nova-senha'),
    });
    return error ? { ok: false, message: authErrorMessage(error) } : { ok: true };
  }, []);

  const verifyEmailCode = useCallback(async (
    email: string,
    code: string
  ): Promise<AuthActionResult> => {
    if (!supabase) return missingConfiguration();
    if (!isValidEmailOtp(code)) {
      return {
        ok: false,
        message: `Digite os ${EMAIL_OTP_LENGTH} números enviados para o seu e-mail.`,
      };
    }

    const { data, error } = await supabase.auth.verifyOtp({
      email: email.trim(),
      token: normalizeEmailOtp(code),
      type: 'email',
    });
    if (error || !data.session) {
      return {
        ok: false,
        message: error
          ? authErrorMessage(error)
          : 'Não foi possível confirmar este código. Solicite um novo código.',
      };
    }
    rememberPendingVerificationEmail();
    return { ok: true };
  }, [rememberPendingVerificationEmail]);

  const resendEmailConfirmation = useCallback(async (
    email: string
  ): Promise<AuthActionResult> => {
    if (!supabase) return missingConfiguration();
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email,
      options: { emailRedirectTo: Linking.createURL('auth/login') },
    });
    if (!error) rememberPendingVerificationEmail(email);
    return error ? { ok: false, message: authErrorMessage(error) } : { ok: true };
  }, [rememberPendingVerificationEmail]);

  const updatePassword = useCallback(async (
    password: string,
    currentPassword?: string
  ): Promise<AuthActionResult> => {
    if (!supabase) return missingConfiguration();
    if (currentPassword && !session) {
      return { ok: false, message: 'Entre novamente para alterar sua senha.' };
    }

    const { error } = await supabase.auth.updateUser({
      password,
      ...(currentPassword ? { current_password: currentPassword } : {}),
    });
    if (error) {
      if (
        currentPassword &&
        (error.code === 'invalid_credentials' || error.code === 'reauthentication_not_valid')
      ) {
        return { ok: false, message: 'Senha atual incorreta.' };
      }
      return { ok: false, message: authErrorMessage(error) };
    }

    await supabase.auth.signOut({ scope: 'others' });
    setRecoveryReady(false);
    return { ok: true };
  }, [session]);

  const deleteRemoteAccount = useCallback(async (
    currentPassword: string
  ): Promise<AuthActionResult> => {
    if (!supabase || !session) {
      return { ok: false, message: 'Entre novamente para excluir sua conta.' };
    }

    const { error } = await supabase.functions.invoke('delete-account', {
      body: { currentPassword },
    });
    if (error instanceof FunctionsHttpError) {
      const response = error.context as Response;
      if (response.status === 403) return { ok: false, message: 'Senha atual incorreta.' };
      if (response.status === 401) {
        return { ok: false, message: 'Sua sessão expirou. Entre novamente para continuar.' };
      }
    }
    if (error) return { ok: false, message: authErrorMessage(error) };
    await supabase.auth.signOut({ scope: 'local' });
    setSession(null);
    setPendingVerificationEmail(undefined);
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
      authLinkChecking,
      pendingVerificationEmail,
      linkError,
      signIn,
      signUp,
      signOut,
      continueAsGuest,
      sendPasswordReset,
      verifyEmailCode,
      resendEmailConfirmation,
      updatePassword,
      deleteRemoteAccount,
    }),
    [
      session,
      isLoading,
      isGuest,
      recoveryReady,
      authLinkChecking,
      pendingVerificationEmail,
      linkError,
      signIn,
      signUp,
      signOut,
      continueAsGuest,
      sendPasswordReset,
      verifyEmailCode,
      resendEmailConfirmation,
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
