import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { URL } from 'node:url';
import test from 'node:test';
import { subscriptionFromRemoteRecord, subscriptionHasAccess } from '../src/core/subscription.ts';

test('an expiry confirmed by the server stays expired with a backdated browser clock', () => {
  const subscription = subscriptionFromRemoteRecord({
    plan: 'diamond',billing_cycle: 'monthly',provider: 'mercado_pago',status: 'expired',
    current_period_end: '2026-01-01T00:00:00Z',cancel_at_period_end: true,
  },new Date('2020-01-01T00:00:00Z'));
  assert.equal(subscriptionHasAccess(subscription,new Date('2020-01-01T00:00:00Z')),false);
});

test('site reads server-derived expiry and refreshes on return without granting through URL parameters', async () => {
  const service = await readFile(new URL('../src/services/supabase.ts',import.meta.url),'utf8');
  const main = await readFile(new URL('../src/main.ts',import.meta.url),'utf8');
  assert.match(service,/\.rpc\('get_current_subscription'\)/);
  assert.match(main,/addEventListener\('visibilitychange'.*refreshSubscriptionOnReturn/);
  assert.match(main,/addEventListener\('focus'.*refreshSubscriptionOnReturn/);
  assert.match(main,/checkout\?\.status === 'approved' && subscriptionHasAccess/);
});
