import type { RecoveryCallback } from './auth-callback.ts';

type PasswordUpdate = { password: string; current_password?: string };
type UserIdentity = { id: string };
type PasswordSecurityAuth<TUser extends UserIdentity> = {
  exchangeCodeForSession(
    code: string,
    options: { flowId: string },
  ): Promise<{ data: { session: { user: TUser } | null }; error: unknown }>;
  getUser(): Promise<{ data: { user: TUser | null } }>;
  updateUser(payload: PasswordUpdate): Promise<{ error: unknown }>;
  signOut(options: { scope: 'others' }): Promise<unknown>;
};

export function createPasswordSecurity<TUser extends UserIdentity>(auth: PasswordSecurityAuth<TUser>) {
  let recoveryUserId: string | null = null;

  return {
    async completeRecovery(callback: RecoveryCallback) {
      recoveryUserId = null;
      const { data, error } = await auth.exchangeCodeForSession(callback.code, {
        flowId: callback.flowId,
      });
      if (error || !data?.session) return null;
      recoveryUserId = data.session.user.id;
      return data.session;
    },
    async updateRecovered(password: string) {
      if (!recoveryUserId) return { ok: false, reason: 'recovery-not-validated' } as const;
      const { data } = await auth.getUser();
      if (data?.user?.id !== recoveryUserId) {
        recoveryUserId = null;
        return { ok: false, reason: 'recovery-not-validated' } as const;
      }
      const { error } = await auth.updateUser({ password });
      if (error) return { ok: false, reason: 'update-failed' } as const;
      recoveryUserId = null;
      await auth.signOut({ scope: 'others' });
      return { ok: true } as const;
    },
    async updateAuthenticated(currentPassword: string, password: string) {
      if (!currentPassword) return { ok: false, reason: 'current-password-required' } as const;
      const { data } = await auth.getUser();
      if (!data?.user) return { ok: false, reason: 'session-required' } as const;
      const { error } = await auth.updateUser({
        password,
        current_password: currentPassword,
      });
      if (error) return { ok: false, reason: 'reauthentication-failed' } as const;
      await auth.signOut({ scope: 'others' });
      return { ok: true } as const;
    },
  };
}
