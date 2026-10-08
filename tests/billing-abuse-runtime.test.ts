import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { URL } from 'node:url';
import vm from 'node:vm';
import test from 'node:test';
import ts from 'typescript';
import { FunctionsHttpError } from '@supabase/supabase-js';
import * as abuse from '../contracts/abuse-errors.ts';

for (const code of ['rate_limited', 'abuse_protection_unavailable']) {
  test(`restore stops on ${code}, preserves confirmed purchases and never finishes blocked ones`, async () => {
    let calls = 0;
    const finished: string[] = [];
    const dependencies: Record<string, unknown> = {
      '@supabase/supabase-js': { FunctionsHttpError },
      '@/contracts/abuse-errors': abuse,
      '@/lib/billing': {
        restoreStorePurchases: async () => ({ ok: true, value: ['first','second','third'].map(id => ({ productId: 'kad_platinum_monthly', purchaseToken: id })) }),
        finishStorePurchase: async (purchase: { purchaseToken: string }) => { finished.push(purchase.purchaseToken); return { ok: true }; },
      },
      '@/lib/supabase': { supabase: { functions: { invoke: async () => {
        calls++;
        return calls === 1 ? { data: { ok: true, entitled: true } } : {
          error: new FunctionsHttpError(Response.json({ code }, { status: code === 'rate_limited' ? 429 : 503, headers: { 'Retry-After': '30' } })),
        };
      } } } },
    };
    const source = readFileSync(new URL('../lib/subscriptions.ts', import.meta.url), 'utf8');
    const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
    const exports = {} as { restoreGoogleSubscriptions: () => Promise<{ ok: boolean; restored: number; entitled: number; message: string }> };
    vm.runInNewContext(compiled, { exports, require: (name: string) => dependencies[name] ?? {} });
    const result = await exports.restoreGoogleSubscriptions();
    assert.equal(result.ok, false); assert.equal(result.restored, 1); assert.equal(result.entitled, 1);
    assert.equal(calls, 2); assert.deepEqual(finished, ['first']);
    assert.match(result.message, /tentativas/);
  });
}
