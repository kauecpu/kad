export type LocalSignOutAuth = {
  signOut(options: { scope: 'local' }): Promise<unknown>;
};

export async function signOutLocally(auth: LocalSignOutAuth): Promise<void> {
  await auth.signOut({ scope: 'local' });
}
