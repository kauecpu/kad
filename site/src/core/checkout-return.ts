import type { Route, StorageLike } from '../types/domain.ts';

const CHECKOUT_RETURN_KEY = 'kad.checkout-return.v1';
const CHECKOUT_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isCheckoutId(value: unknown): value is string {
  return typeof value === 'string' && CHECKOUT_ID.test(value);
}

export function checkoutReturnPath(checkoutId: unknown): string | null {
  return isCheckoutId(checkoutId) ? `/perfil/planos?checkout=${checkoutId}` : null;
}

export function checkoutReturnFromRoute(route: Route): string | null {
  return route.pathname === '/perfil/planos' ? checkoutReturnPath(route.params.checkout) : null;
}

export function validateCheckoutReturn(target: unknown): string | null {
  if (typeof target !== 'string') return null;
  try {
    const url = new URL(target, 'https://kad.invalid');
    if (url.origin !== 'https://kad.invalid' || url.pathname !== '/perfil/planos') return null;
    if (url.hash || url.searchParams.getAll('checkout').length !== 1
      || [...url.searchParams.keys()].some((key) => key !== 'checkout')) return null;
    return checkoutReturnPath(url.searchParams.get('checkout'));
  } catch {
    return null;
  }
}

export function rememberCheckoutReturn(storage: StorageLike | null, target: unknown): string | null {
  const safeTarget = validateCheckoutReturn(target);
  if (!storage || !safeTarget) return safeTarget;
  try { storage.setItem(CHECKOUT_RETURN_KEY, safeTarget); } catch { /* Storage may be unavailable. */ }
  return safeTarget;
}

export function readCheckoutReturn(storage: StorageLike | null, routeTarget?: unknown): string | null {
  const fromRoute = validateCheckoutReturn(routeTarget);
  if (fromRoute) return fromRoute;
  if (!storage) return null;
  try { return validateCheckoutReturn(storage.getItem(CHECKOUT_RETURN_KEY)); } catch { return null; }
}

export function clearCheckoutReturn(storage: StorageLike | null): void {
  if (!storage) return;
  try { storage.removeItem(CHECKOUT_RETURN_KEY); } catch { /* Storage may be unavailable. */ }
}

export function authRouteWithCheckout(pathname: '/entrar' | '/cadastro', target: unknown): string {
  const safeTarget = validateCheckoutReturn(target);
  return safeTarget ? `${pathname}?returnTo=${encodeURIComponent(safeTarget)}` : pathname;
}

export function confirmationRouteWithCheckout(target: unknown): string {
  const safeTarget = validateCheckoutReturn(target);
  return safeTarget ? `/confirmar-email?returnTo=${encodeURIComponent(safeTarget)}` : '/confirmar-email';
}
