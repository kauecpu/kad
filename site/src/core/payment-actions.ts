type PaymentContext = { userId: string | null; route: string };

// One lane for manual financial actions: a refresh cannot overwrite a later cancel.
export function createPaymentActionScope(readContext: () => PaymentContext, onBegin: () => void = () => {}) {
  let context = readContext();
  let generation = 0;
  let active = false;
  const sync = () => {
    const next = readContext();
    if (next.userId !== context.userId || next.route !== context.route) { generation += 1; active = false; }
    context = next;
  };
  return {
    sync,
    clear() { generation += 1; active = false; },
    observe() {
      sync();
      const request = generation;
      const userId = context.userId;
      return { userId, isCurrent() { sync(); return Boolean(userId) && !active && generation === request; } };
    },
    begin() {
      sync();
      onBegin();
      const request = ++generation;
      active = true;
      const userId = context.userId;
      return {
        userId,
        finish() { if (generation === request) { generation += 1; active = false; } },
        isCurrent() {
          sync();
          return Boolean(userId) && generation === request;
        },
      };
    },
  };
}

// Pin mutations to the account that requested them, not whatever account the SDK
// happens to find after an await. The Edge Function still verifies the JWT itself.
export async function ownedPaymentAuthorization(
  expectedUserId: string,
  isCurrent: () => boolean,
  readSession: () => Promise<{ user: { id: string }; access_token: string } | null>,
): Promise<{ Authorization: string } | null> {
  if (!isCurrent()) return null;
  const session = await readSession();
  if (!isCurrent() || session?.user.id !== expectedUserId || !session.access_token) return null;
  return { Authorization: `Bearer ${session.access_token}` };
}
