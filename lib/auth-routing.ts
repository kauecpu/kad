export type AuthRouteState = {
  hasSession: boolean;
  isGuest: boolean;
  isLoading?: boolean;
};

export function authRouteAccess({
  hasSession,
  isGuest,
  isLoading = false,
}: AuthRouteState) {
  const app = isLoading || hasSession || isGuest;

  return {
    welcome: !isLoading && !app,
    auth: !hasSession,
    app,
  };
}
