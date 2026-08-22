import type { ThemePreference } from '@/types';

export type FrameScheduler = {
  request: (callback: () => void) => number;
  cancel: (handle: number) => void;
};

export function shouldFreezeInactiveTabs(platform: string) {
  return platform !== 'web';
}

export function isThemePersistenceReady(
  hydrated: boolean,
  synchronizedHydrationKey: string | null,
  hydrationKey: string | null
) {
  return (
    hydrated &&
    hydrationKey !== null &&
    synchronizedHydrationKey === hydrationKey
  );
}

export function getThemeHydrationMarker(
  hydrated: boolean,
  hydrationKey: string | null
) {
  return hydrated ? hydrationKey : null;
}

export function isThemeResetPersistencePending(
  resetVersion: number,
  acknowledgedResetVersion: number
) {
  return resetVersion !== acknowledgedResetVersion;
}

export function createDeferredThemeCommitter(
  commit: (preference: ThemePreference) => void,
  scheduler: FrameScheduler
) {
  const requestFrame = scheduler.request;
  const cancelFrame = scheduler.cancel;
  let frameHandle: number | null = null;
  let pendingPreference: ThemePreference | null = null;

  function cancelPendingFrame() {
    if (frameHandle === null) return;
    cancelFrame(frameHandle);
    frameHandle = null;
  }

  return {
    select(preference: ThemePreference) {
      pendingPreference = preference;
      if (frameHandle !== null) return;

      frameHandle = requestFrame(() => {
        frameHandle = requestFrame(() => {
          frameHandle = null;
          const nextPreference = pendingPreference;
          pendingPreference = null;
          if (nextPreference) commit(nextPreference);
        });
      });
    },
    dispose() {
      cancelPendingFrame();
      pendingPreference = null;
    },
  };
}
