import type { CheckoutProgress } from '../types/domain.ts';

// A retry of the same checkout is a new request, even if the user/URL did not change.
export function createCheckoutRequestScope() {
  let active: { checkoutId: string; userId: string } | null = null;
  return {
    matches(checkoutId: string, userId: string) {
      return active?.checkoutId === checkoutId && active.userId === userId;
    },
    begin(checkoutId: string, userId: string) {
      const request = { checkoutId, userId };
      active = request;
      return () => active === request;
    },
    clear() { active = null; },
  };
}

export async function withPaymentTimeout<T>(request: Promise<T>, timeoutMs = 12_000): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      request,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error('payment_read_timeout')), timeoutMs);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

export function checkoutProgressAfterPolling(
  checkout: CheckoutProgress | null,
  refreshReason: string | null
): CheckoutProgress {
  // Never downgrade a confirmed charge just because access synchronization is delayed.
  if (checkout?.status === 'approved') return checkout;
  if (!checkout || refreshReason) {
    return { status: 'unavailable', reason: refreshReason ?? 'provider_unavailable' };
  }
  return { status: 'pending', reason: checkout.reason ?? null };
}
