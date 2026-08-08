export type AuthRouteState = {
  hasSession: boolean;
  isGuest: boolean;
};

export function authRouteAccess({
  hasSession,
  isGuest,
}: AuthRouteState) {
  const app = hasSession || isGuest;

  return {
    welcome: !app,
    auth: !hasSession,
    app,
  };
}
