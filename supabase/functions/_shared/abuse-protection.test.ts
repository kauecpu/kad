import { boundedFetch, enforceAbuseLimit, readRequestObject, RequestBodyError } from './abuse-protection.ts';

function equal(actual: unknown, expected: unknown) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error(`Expected ${JSON.stringify(expected)}; got ${JSON.stringify(actual)}`);
}

Deno.test('limiter: allow, deny, Retry-After, invalid responses, exceptions, safe logs', async () => {
  const saved = console.warn; const logs: string[] = [];
  console.warn = value => logs.push(String(value));
  try {
    for (const scenario of ['allow','deny','error','throw','empty','malformed']) {
      const store = { rpc(name: string, args: Record<string, unknown>) {
        equal(name, 'consume_abuse_limit');
        equal(args, { p_user_id: 'authenticated-id', p_operation: 'google_purchase_validate' });
        if (scenario === 'throw') throw new Error('sensitive-token');
        return Promise.resolve({ error: scenario === 'error' ? 'sensitive-token' : null,
          data: scenario === 'empty' ? [] : [{ allowed: scenario !== 'deny', retry_after_seconds: scenario === 'malformed' ? -1 : scenario === 'deny' ? 23 : 0 }] });
      } };
      const response = await enforceAbuseLimit(store, 'authenticated-id', 'google_purchase_validate', null, 'correlation');
      equal(response?.status ?? 200, scenario === 'allow' ? 200 : scenario === 'deny' ? 429 : 503);
      if (scenario === 'deny') equal(response?.headers.get('Retry-After'), '23');
      await response?.body?.cancel();
    }
    if (logs.join('').includes('sensitive-token') || logs.join('').includes('authenticated-id')) throw new Error('Sensitive log');
    for (const log of logs) { const value = JSON.parse(log); if (!value.at || !value.requestId || !value.reason) throw new Error('Missing log context'); }
  } finally { console.warn = saved; }
});

Deno.test('body size, chunking, invalid JSON, arrays, null and empty cancellation', async () => {
  equal(await readRequestObject(new Request('https://fixture.invalid', { method: 'POST' }), 16, true), {});
  for (const body of ['null', '[]', '{broken', '"text"', 'x'.repeat(17)]) {
    try {
      await readRequestObject(new Request('https://fixture.invalid', { method:'POST', headers:{'content-type':'application/json'}, body }), 16);
      throw new Error('Unexpected acceptance');
    } catch (error) { if (!(error instanceof RequestBodyError)) throw error; equal(error.status, body.length > 16 ? 413 : 400); }
  }
  const stream = new ReadableStream({ start(controller) {
    controller.enqueue(new TextEncoder().encode('{"x":"'));
    controller.enqueue(new TextEncoder().encode('y'.repeat(30))); controller.close();
  } });
  try {
    await readRequestObject(new Request('https://fixture.invalid', { method:'POST', headers:{'content-type':'application/json','content-length':'2'}, body:stream }), 16);
    throw new Error('Oversize chunked body accepted');
  } catch (error) { if (!(error instanceof RequestBodyError)) throw error; equal(error.status, 413); }
});

Deno.test('bounded fetch does not retry and enforces response size and cancellation', async () => {
  const original = globalThis.fetch; let calls = 0;
  try {
    globalThis.fetch = async () => { calls++; return new Response('x'.repeat(1024*1024+1)); };
    let failed = false;
    try { await boundedFetch('https://fixture.invalid'); } catch { failed = true; }
    equal(failed, true); equal(calls, 1);
    const abort = new AbortController(); abort.abort();
    globalThis.fetch = async (_input, init) => { equal(init?.signal?.aborted, true); throw new DOMException('Aborted','AbortError'); };
    try { await boundedFetch('https://fixture.invalid', { signal: abort.signal }); } catch { /* expected */ }
  } finally { globalThis.fetch = original; }
});

Deno.test('timeouts include a stalled upstream body and a stalled incoming body', async () => {
  const original = globalThis.fetch; const originalTimer = globalThis.setTimeout;
  const delays: number[] = [];
  globalThis.setTimeout = ((callback: (...args: unknown[]) => void, ms?: number) => {
    delays.push(ms ?? 0); return originalTimer(callback, 1);
  }) as typeof setTimeout;
  try {
    globalThis.fetch = async (_input, init) => new Response(new ReadableStream({start(controller) {
      init?.signal?.addEventListener('abort', () => controller.error(new DOMException('Aborted','AbortError')), {once:true});
    }}));
    let failed = false;
    try { await boundedFetch('https://fixture.invalid'); } catch { failed = true; }
    equal(failed,true);
    try {
      await readRequestObject(new Request('https://fixture.invalid',{method:'POST',body:new ReadableStream()}),100);
      throw new Error('Accepted stalled body');
    } catch (error) { if (!(error instanceof RequestBodyError)) throw error; equal(error.status,408); }
    equal(delays,[8000,5000]);
  } finally { globalThis.fetch=original; globalThis.setTimeout=originalTimer; }
});
