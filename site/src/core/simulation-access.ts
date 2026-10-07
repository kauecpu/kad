import { createPaymentActionScope } from './payment-actions.ts';
import { withPaymentTimeout } from './payment-polling.ts';
import { subscriptionHasAccess } from './subscription.ts';
import type { Subscription } from '../types/domain.ts';

export type SimulationAccess = 'allowed' | 'login' | 'subscription' | 'unavailable' | 'stale';

/** UI gate only: never trust the cached plan to start a paid activity. */
export function createSimulationAccess(
  readContext: () => { userId: string | null; route: string },
  loadSubscription: (userId: string) => Promise<Subscription | null>,
) {
  const scope = createPaymentActionScope(readContext);
  return {
    sync: scope.sync,
    clear: scope.clear,
    async check(onAllowed: () => void = () => {}): Promise<SimulationAccess> {
      const request = scope.begin();
      if (!request.userId) { request.finish(); return 'login'; }
      try {
        const subscription = await withPaymentTimeout(loadSubscription(request.userId));
        if (!request.isCurrent()) return 'stale';
        if (!subscription) return 'unavailable';
        if (!subscriptionHasAccess(subscription)) return 'subscription';
        // Apply synchronously while this owner/request is still current.
        onAllowed();
        return 'allowed';
      } catch {
        return request.isCurrent() ? 'unavailable' : 'stale';
      } finally {
        request.finish();
      }
    },
  };
}
