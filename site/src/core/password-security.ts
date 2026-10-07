import type { RecoveryCallback } from './auth-callback.ts';
import { recoveryFailure } from './password-recovery.ts';

type PasswordUpdate = { password: string; current_password?: string };
type UserIdentity = { id: string };
type PasswordSecurityAuth<TUser extends UserIdentity> = {
  exchangeCodeForSession(
    code: string,
    options: { flowId: string },
  ): Promise<{ data: { session: { user: TUser } | null; redirectType?: string | null }; error: unknown }>;
  getUser(): Promise<{ data: { user: TUser | null }; error?: unknown }>;
  updateUser(payload: PasswordUpdate): Promise<{ error: unknown }>;
  signOut(options: { scope: 'others' | 'local' }): Promise<{ error?: unknown } | void>;
};

export function createPasswordSecurity<TUser extends UserIdentity>(auth: PasswordSecurityAuth<TUser>) {
  let recoveryUserId: string | null = null;
  let updatingRecovery = false;

  return {
    async completeRecovery(callback: RecoveryCallback) {
      recoveryUserId = null;
      try {
        const { data, error } = await auth.exchangeCodeForSession(callback.code, {
          flowId: callback.flowId,
        });
        if (error) return { ok: false, reason: recoveryFailure(error) } as const;
        if (!data?.session || data.redirectType !== 'recovery') return { ok: false, reason: 'invalid-link' } as const;
        recoveryUserId = data.session.user.id;
        return { ok: true, session: data.session } as const;
      } catch (error) {
        return { ok: false, reason: recoveryFailure(error) } as const;
      }
    },
    async updateRecovered(password: string) {
      if (!recoveryUserId) return { ok: false, reason: 'recovery-not-validated' } as const;
      if (updatingRecovery) return { ok: false, reason: 'update-in-progress' } as const;
      updatingRecovery = true;
      try {
        const { data, error: userError } = await auth.getUser();
        if (userError) {
          const reason = recoveryFailure(userError);
          if (reason === 'session-missing') recoveryUserId = null;
          return { ok: false, reason } as const;
        }
        if (data?.user?.id !== recoveryUserId) {
          recoveryUserId = null;
          return { ok: false, reason: 'recovery-not-validated' } as const;
        }
        const { error } = await auth.updateUser({ password });
        if (error) return { ok: false, reason: recoveryFailure(error) } as const;
        recoveryUserId = null;
        // The password is already changed. A logout failure must not report a failed password update.
        let sessionsRevoked = true;
        for (const scope of ['others', 'local'] as const) {
          try {
            const result = await auth.signOut({ scope });
            if (result?.error) sessionsRevoked = false;
          } catch { sessionsRevoked = false; }
        }
        return sessionsRevoked ? { ok: true } as const : { ok: true, warning: 'logout-failed' } as const;
      } catch (error) {
        return { ok: false, reason: recoveryFailure(error) } as const;
      } finally {
        updatingRecovery = false;
      }
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
