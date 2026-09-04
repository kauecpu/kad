let handler: ((request: Request) => Promise<Response>) | undefined;
const originalServe = Object.getOwnPropertyDescriptor(Deno,'serve')!;
Object.defineProperty(Deno,'serve',{ configurable: true,value: (callback: typeof handler) => { handler = callback; } });
try { await import('./index.ts'); } finally { Object.defineProperty(Deno,'serve',originalServe); }

for (const scenario of ['confirmed','wrong-resource','unconfirmed-status','timeout','persistence-failure']) {
  Deno.test(`cancellation HTTP: ${scenario}`,async () => {
    const names = ['SUPABASE_URL','SUPABASE_ANON_KEY','SUPABASE_SERVICE_ROLE_KEY','MERCADO_PAGO_ACCESS_TOKEN'];
    const saved = names.map((name) => Deno.env.get(name));
    names.forEach((name,index) => Deno.env.set(name,index === 0 ? 'https://database.invalid' : 'synthetic-only'));
    const before = globalThis.fetch; const beforeError = console.error;
    let writes = 0;
    globalThis.fetch = async (input,init) => {
      const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url);
      if (url.hostname === 'database.invalid') {
        if (url.pathname === '/auth/v1/user') return Response.json({ id: '10000000-0000-4000-8000-000000000001' });
        if (url.pathname.endsWith('/subscriptions')) return Response.json({ provider: 'mercado_pago',
          provider_subscription_id: 'synthetic-sub',cancel_at_period_end: false,current_period_end: '2030-02-01T00:00:00Z' });
        if (url.pathname.endsWith('/sync_mercado_pago_subscription')) {
          writes += 1;
          return Response.json(scenario === 'persistence-failure' ? { message: 'synthetic error' } : null,
            { status: scenario === 'persistence-failure' ? 500 : 200 });
        }
      }
      if (url.hostname === 'api.mercadopago.com' && url.pathname === '/preapproval/synthetic-sub' && init?.method === 'PUT') {
        if (scenario === 'timeout') return new Promise((_resolve,reject) => {
          init.signal?.addEventListener('abort',() => reject(new DOMException('Synthetic timeout','AbortError')),{ once: true });
        });
        return Response.json({ id: scenario === 'wrong-resource' ? 'other' : 'synthetic-sub',
          status: scenario === 'unconfirmed-status' ? 'authorized' : 'canceled',last_modified: '2030-01-02T00:00:00Z' });
      }
      throw new Error('Unexpected synthetic request');
    };
    console.error = () => {};
    try {
      const response = await handler!(new Request('https://example.invalid',{ method: 'POST',headers: { Authorization: 'Bearer synthetic-only' } }));
      const expected = scenario === 'confirmed' ? 200 : 502;
      if (response.status !== expected) throw new Error(`Expected ${expected}, got ${response.status}`);
      if (['wrong-resource','unconfirmed-status','timeout'].includes(scenario) && writes !== 0) throw new Error('Unconfirmed cancellation must not persist');
      await response.body?.cancel();
    } finally {
      globalThis.fetch = before; console.error = beforeError;
      names.forEach((name,index) => saved[index] === undefined ? Deno.env.delete(name) : Deno.env.set(name,saved[index]!));
    }
  });
}
