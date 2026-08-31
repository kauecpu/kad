export type AuthProfileMetadata = {
  name?: unknown;
  full_name?: unknown;
};

function validName(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

export function displayNameFromMetadata(metadata: AuthProfileMetadata | null | undefined, fallback: string): string {
  return validName(metadata?.name) ?? validName(metadata?.full_name) ?? fallback;
}

export function buildSignupMetadata(name: string): { name: string } {
  return { name: name.trim() };
}
