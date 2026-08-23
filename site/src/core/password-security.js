export function createPasswordSecurity(auth) {
  let recoveryUserId = null;

  return {
    async completeRecovery(callback) {
      recoveryUserId = null;
      const { data, error } = await auth.exchangeCodeForSession(callback.code, {
        flowId: callback.flowId,
      });
      if (error || !data?.session) return null;
      recoveryUserId = data.session.user.id;
      return data.session;
    },
    async updateRecovered(password) {
      if (!recoveryUserId) return { ok: false, reason: 'recovery-not-validated' };
      const { data } = await auth.getUser();
      if (data?.user?.id !== recoveryUserId) {
        recoveryUserId = null;
        return { ok: false, reason: 'recovery-not-validated' };
      }
      const { error } = await auth.updateUser({ password });
      if (error) return { ok: false, reason: 'update-failed' };
      recoveryUserId = null;
      await auth.signOut({ scope: 'others' });
      return { ok: true };
    },
    async updateAuthenticated(currentPassword, password) {
      if (!currentPassword) return { ok: false, reason: 'current-password-required' };
      const { data } = await auth.getUser();
      if (!data?.user) return { ok: false, reason: 'session-required' };
      const { error } = await auth.updateUser({
        password,
        current_password: currentPassword,
      });
      if (error) return { ok: false, reason: 'reauthentication-failed' };
      await auth.signOut({ scope: 'others' });
      return { ok: true };
    },
  };
}
