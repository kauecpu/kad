/** Bind a request to the captured session, including when the SDK changes accounts. */
export async function ownedStudyRequest<T>(
  userId: string,
  auth: { getSession(): Promise<{ data: { session: { user: { id: string }; access_token: string } | null }; error?: unknown }> },
  request: (authorization: string, signal: AbortSignal) => PromiseLike<T>,
): Promise<T> {
  const controller = new AbortController();
  let timeout: ReturnType<typeof setTimeout>;
  const expired = new Promise<never>((_, reject) => {
    timeout = setTimeout(() => { controller.abort(); reject(new Error('Study request timed out')); }, 15_000);
  });
  try {
    return await Promise.race([expired, (async () => {
      const { data, error } = await auth.getSession();
      if (error || data.session?.user.id !== userId || controller.signal.aborted) throw new Error('Study session unavailable');
      return await request(`Bearer ${data.session.access_token}`, controller.signal);
    })()]);
  } finally { clearTimeout(timeout!); }
}
