import { corsHeaders } from './http.ts';

export type ProtectedOperation = 'google_purchase_validate' | 'subscription_cancel' | 'account_delete';
type LimitStore = { rpc(name: string, args: Record<string, unknown>): PromiseLike<{ data: unknown; error: unknown }> };

export function logSecurityEvent(operation: ProtectedOperation, reason: string, requestId: string) {
  // Only internal enums/correlation IDs. Never include errors, payloads or headers.
  console.warn(JSON.stringify({ event: 'abuse_protection', operation, reason, requestId, at: new Date().toISOString() }));
}

export function securityResponse(code: string, status: number, origin: string | null, requestId: string, retryAfter?: number) {
  return Response.json({ error: code, code, requestId }, { status, headers: {
    ...corsHeaders(origin), 'Cache-Control': 'no-store', 'X-Request-ID': requestId,
    'Access-Control-Expose-Headers': 'Retry-After, X-Request-ID',
    ...(retryAfter === undefined ? {} : { 'Retry-After': String(retryAfter) }),
  } });
}

export async function enforceAbuseLimit(store: LimitStore, userId: string, operation: ProtectedOperation,
  origin: string | null, requestId: string): Promise<Response | null> {
  try {
    const { data, error } = await store.rpc('consume_abuse_limit', { p_user_id: userId, p_operation: operation });
    const row = Array.isArray(data) && data.length === 1 ? data[0] : null;
    if (error || !row || typeof row.allowed !== 'boolean' || !Number.isInteger(row.retry_after_seconds)
      || row.retry_after_seconds < 0 || row.retry_after_seconds > 86400
      || (row.allowed && row.retry_after_seconds !== 0) || (!row.allowed && row.retry_after_seconds < 1)) {
      throw new Error('Invalid limiter response');
    }
    if (row.allowed) return null;
    logSecurityEvent(operation, 'rate_limited', requestId);
    return securityResponse('rate_limited', 429, origin, requestId, row.retry_after_seconds);
  } catch {
    logSecurityEvent(operation, 'limiter_unavailable', requestId);
    return securityResponse('abuse_protection_unavailable', 503, origin, requestId, 30);
  }
}

export class RequestBodyError extends Error {
  constructor(readonly code: string, readonly status: number) { super(code); }
}

/** Bounds the actual stream, including chunked requests and dishonest Content-Length. */
export async function readRequestObject(request: Request, maxBytes: number, allowEmpty = false): Promise<Record<string, unknown>> {
  const declared = request.headers.get('content-length');
  if (declared && (!/^\d+$/.test(declared) || Number(declared) > maxBytes)) {
    throw new RequestBodyError('payload_too_large', 413);
  }
  const reader = request.body?.getReader();
  if (!reader) {
    if (allowEmpty) return {};
    throw new RequestBodyError('invalid_request', 400);
  }
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const text = await Promise.race([
      (async () => {
        const decoder = new TextDecoder('utf-8', { fatal: true });
        let size = 0; let text = '';
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          size += value.byteLength;
          if (size > maxBytes) throw new RequestBodyError('payload_too_large', 413);
          text += decoder.decode(value, { stream: true });
        }
        return text + decoder.decode();
      })(),
      new Promise<never>((_resolve, reject) => { timer = setTimeout(() => reject(new RequestBodyError('request_timeout', 408)), 5000); }),
    ]);
    if (!text && allowEmpty) return {};
    if (!/^application\/json(?:;|$)/i.test(request.headers.get('content-type') ?? '')) throw new RequestBodyError('invalid_request', 400);
    const body: unknown = JSON.parse(text);
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new RequestBodyError('invalid_request', 400);
    return body as Record<string, unknown>;
  } catch (error) {
    void reader.cancel().catch(() => {});
    throw error instanceof RequestBodyError ? error : new RequestBodyError('invalid_request', 400);
  } finally { clearTimeout(timer); }
}

/** No retries. Timeout includes response body consumption, with a 1 MiB ceiling. */
export const boundedFetch: typeof fetch = async (input, init) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  const upstream = init?.signal ?? (input instanceof Request ? input.signal : undefined);
  const abort = () => controller.abort();
  if (upstream?.aborted) abort();
  upstream?.addEventListener('abort', abort, { once: true });
  try {
    const response = await fetch(input, { ...init, signal: controller.signal });
    const reader = response.body?.getReader();
    if (!reader) return response;
    const chunks: Uint8Array[] = []; let size = 0;
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > 1024 * 1024) throw new Error('Upstream response too large');
        chunks.push(value);
      }
    } catch (error) { void reader.cancel().catch(() => {}); throw error; }
    const body = new Uint8Array(size); let offset = 0;
    for (const chunk of chunks) { body.set(chunk, offset); offset += chunk.byteLength; }
    return new Response(body, { status: response.status, statusText: response.statusText, headers: response.headers });
  } finally {
    clearTimeout(timer);
    upstream?.removeEventListener('abort', abort);
  }
};
