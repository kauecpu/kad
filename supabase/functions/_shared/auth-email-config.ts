export type AuthEmailRuntimeConfig = {
  resendApiKey: string;
  hookSecret: string;
  brandName: string;
  fromAddress: string;
  replyTo?: string;
  allowedRedirectPrefixes: string[];
  supabaseUrl: string;
};

export class AuthEmailConfigurationError extends Error {
  readonly missingOrInvalidNames: string[];

  constructor(missingOrInvalidNames: string[]) {
    super('auth_email_configuration_invalid');
    this.name = 'AuthEmailConfigurationError';
    this.missingOrInvalidNames = missingOrInvalidNames;
  }
}

const CONTROL_CHARACTER = /[\u0000-\u001f\u007f]/;
const BRAND_DELIMITER = /[<>"\\,;]/;
const MAILBOX_PATTERN = /^[^\s@<>"\\,;]+@[^\s@<>"\\,;]+$/;

function hasControlCharacter(value: string): boolean {
  return CONTROL_CHARACTER.test(value);
}

function isMailbox(value: string): boolean {
  return value.length > 0 && !hasControlCharacter(value) && MAILBOX_PATTERN.test(value) && value.split('@').length === 2;
}

function isBrandName(value: string): boolean {
  return value.length >= 1 && value.length <= 80 && !hasControlCharacter(value) && !BRAND_DELIMITER.test(value);
}

function normalizeHookSecret(value: string): string | undefined {
  const normalized = value.startsWith('v1,') ? value.slice(3) : value;
  if (!normalized.startsWith('whsec_')) return undefined;
  const encoded = normalized.slice('whsec_'.length);
  if (encoded.length === 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(encoded) || encoded.length % 4 !== 0) {
    return undefined;
  }
  let decoded: Uint8Array;
  try {
    decoded = Uint8Array.from(atob(encoded), (character) => character.charCodeAt(0));
  } catch {
    return undefined;
  }
  if (decoded.length < 24 || decoded.length > 64 || btoa(String.fromCharCode(...decoded)) !== encoded) {
    return undefined;
  }
  return normalized;
}

function normalizeRedirectPrefixes(value: string): string[] | undefined {
  const prefixes = [...new Set(value.split(',').map((prefix) => prefix.trim()).filter(Boolean))];
  if (prefixes.length === 0) return undefined;
  for (const prefix of prefixes) {
    const customScheme = /^[a-z][a-z0-9+.-]*:\/\/$/i.test(prefix);
    if (customScheme && !prefix.toLowerCase().startsWith('http')) continue;
    let parsed: URL;
    try {
      parsed = new URL(prefix);
    } catch {
      return undefined;
    }
    if (
      parsed.protocol !== 'https:' ||
      parsed.username ||
      parsed.password ||
      parsed.search ||
      parsed.hash
    ) return undefined;
  }
  return prefixes;
}

function normalizeSupabaseUrl(value: string): string | undefined {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return undefined;
  }
  const localHost = url.hostname === 'localhost' || url.hostname === '127.0.0.1';
  if (
    !url.hostname ||
    url.username ||
    url.password ||
    url.pathname !== '/' ||
    url.search ||
    url.hash ||
    (url.protocol !== 'https:' && !(url.protocol === 'http:' && localHost))
  ) return undefined;
  return url.origin;
}

export function loadAuthEmailConfig(
  readEnv: (name: string) => string | undefined
): AuthEmailRuntimeConfig {
  const resendApiKey = readEnv('RESEND_API_KEY');
  const hookSecret = readEnv('SEND_EMAIL_HOOK_SECRET');
  const brandName = readEnv('EMAIL_BRAND_NAME');
  const fromAddress = readEnv('EMAIL_FROM_ADDRESS');
  const replyTo = readEnv('EMAIL_REPLY_TO');
  const redirectPrefixes = readEnv('EMAIL_ALLOWED_REDIRECT_PREFIXES');
  const supabaseUrl = readEnv('SUPABASE_URL');
  const normalizedSecret = hookSecret === undefined ? undefined : normalizeHookSecret(hookSecret);
  const normalizedPrefixes = redirectPrefixes === undefined ? undefined : normalizeRedirectPrefixes(redirectPrefixes);
  const normalizedSupabaseUrl = supabaseUrl === undefined ? undefined : normalizeSupabaseUrl(supabaseUrl);
  const invalidNames = [
    ...(resendApiKey === undefined || !resendApiKey.startsWith('re_') || hasControlCharacter(resendApiKey) ? ['RESEND_API_KEY'] : []),
    ...(normalizedSecret === undefined ? ['SEND_EMAIL_HOOK_SECRET'] : []),
    ...(brandName === undefined || !isBrandName(brandName) ? ['EMAIL_BRAND_NAME'] : []),
    ...(fromAddress === undefined || !isMailbox(fromAddress) ? ['EMAIL_FROM_ADDRESS'] : []),
    ...(replyTo !== undefined && !isMailbox(replyTo) ? ['EMAIL_REPLY_TO'] : []),
    ...(normalizedPrefixes === undefined ? ['EMAIL_ALLOWED_REDIRECT_PREFIXES'] : []),
    ...(normalizedSupabaseUrl === undefined ? ['SUPABASE_URL'] : []),
  ];
  if (invalidNames.length > 0) throw new AuthEmailConfigurationError(invalidNames);
  return {
    resendApiKey: resendApiKey!,
    hookSecret: normalizedSecret!,
    brandName: brandName!,
    fromAddress: fromAddress!,
    ...(replyTo === undefined ? {} : { replyTo }),
    allowedRedirectPrefixes: normalizedPrefixes!,
    supabaseUrl: normalizedSupabaseUrl!,
  };
}

export function isAllowedAuthRedirect(value: string, prefixes: string[]): boolean {
  let target: URL;
  try {
    target = new URL(value);
  } catch {
    return false;
  }
  for (const prefix of prefixes) {
    if (/^[a-z][a-z0-9+.-]*:\/\/$/i.test(prefix)) {
      if (target.protocol === prefix.slice(0, -2)) return true;
      continue;
    }
    let allowed: URL;
    try {
      allowed = new URL(prefix);
    } catch {
      continue;
    }
    if (
      target.protocol !== 'https:' ||
      target.username ||
      target.password ||
      target.origin !== allowed.origin
    ) continue;
    const allowedPath = allowed.pathname.endsWith('/')
      ? allowed.pathname.slice(0, -1)
      : allowed.pathname;
    if (target.pathname === allowedPath || target.pathname.startsWith(`${allowedPath}/`)) return true;
  }
  return false;
}

export function formatResendFrom(brandName: string, address: string): string {
  if (!isBrandName(brandName) || !isMailbox(address)) {
    throw new AuthEmailConfigurationError(['EMAIL_BRAND_NAME', 'EMAIL_FROM_ADDRESS']);
  }
  return `${brandName} <${address}>`;
}
