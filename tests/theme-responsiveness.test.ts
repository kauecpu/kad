import assert from 'node:assert/strict';
import test from 'node:test';

import type { ThemePreference } from '../types/index.ts';

type ThemeCommitter = {
  select: (preference: ThemePreference) => void;
  dispose: () => void;
};

type ThemeResponsivenessModule = {
  createDeferredThemeCommitter?: (
    commit: (preference: ThemePreference) => void,
    scheduler: {
      request: (callback: () => void) => number;
      cancel: (handle: number) => void;
    }
  ) => ThemeCommitter;
  shouldFreezeInactiveTabs?: (platform: string) => boolean;
  isThemePersistenceReady?: (
    hydrated: boolean,
    synchronizedHydrationKey: string | null,
    hydrationKey: string | null
  ) => boolean;
  getThemeHydrationMarker?: (
    hydrated: boolean,
    hydrationKey: string | null
  ) => string | null;
  isThemeResetPersistencePending?: (
    resetVersion: number,
    acknowledgedResetVersion: number
  ) => boolean;
};

const modulePath = '../lib/' + 'theme-responsiveness.ts';
let themeResponsiveness: ThemeResponsivenessModule = {};

try {
  themeResponsiveness = (await import(modulePath)) as ThemeResponsivenessModule;
} catch {
  // O primeiro ciclo RED ocorre antes de o módulo de produção existir.
}

function createFrameScheduler() {
  let nextHandle = 1;
  const callbacks = new Map<number, () => void>();

  return {
    scheduler: {
      request(callback: () => void) {
        const handle = nextHandle++;
        callbacks.set(handle, callback);
        return handle;
      },
      cancel(handle: number) {
        callbacks.delete(handle);
      },
    },
    flush() {
      const queued = [...callbacks.values()];
      callbacks.clear();
      queued.forEach((callback) => callback());
    },
  };
}

test('a preferência visual recebe um frame para pintar antes de confirmar o tema global', () => {
  assert.equal(typeof themeResponsiveness.createDeferredThemeCommitter, 'function');

  const commits: ThemePreference[] = [];
  const { scheduler, flush } = createFrameScheduler();
  const committer = themeResponsiveness.createDeferredThemeCommitter!(
    (preference) => commits.push(preference),
    scheduler
  );

  committer.select('dark');
  assert.deepEqual(commits, []);

  flush();
  assert.deepEqual(commits, []);

  flush();
  assert.deepEqual(commits, ['dark']);
});

test('toques rápidos confirmam somente a preferência mais recente', () => {
  assert.equal(typeof themeResponsiveness.createDeferredThemeCommitter, 'function');

  const commits: ThemePreference[] = [];
  const { scheduler, flush } = createFrameScheduler();
  const committer = themeResponsiveness.createDeferredThemeCommitter!(
    (preference) => commits.push(preference),
    scheduler
  );

  committer.select('dark');
  committer.select('light');
  flush();
  committer.select('system');
  flush();

  assert.deepEqual(commits, ['system']);
});

test('desmontar o controle cancela uma confirmação pendente', () => {
  assert.equal(typeof themeResponsiveness.createDeferredThemeCommitter, 'function');

  const commits: ThemePreference[] = [];
  const { scheduler, flush } = createFrameScheduler();
  const committer = themeResponsiveness.createDeferredThemeCommitter!(
    (preference) => commits.push(preference),
    scheduler
  );

  committer.select('dark');
  committer.dispose();
  flush();

  assert.deepEqual(commits, []);
});

test('desmontar entre os frames também cancela a confirmação pendente', () => {
  assert.equal(typeof themeResponsiveness.createDeferredThemeCommitter, 'function');

  const commits: ThemePreference[] = [];
  const { scheduler, flush } = createFrameScheduler();
  const committer = themeResponsiveness.createDeferredThemeCommitter!(
    (preference) => commits.push(preference),
    scheduler
  );

  committer.select('dark');
  flush();
  committer.dispose();
  flush();

  assert.deepEqual(commits, []);
});

test('abas inativas são congeladas no mobile sem aplicar uma opção nativa ao web', () => {
  assert.equal(typeof themeResponsiveness.shouldFreezeInactiveTabs, 'function');
  assert.equal(themeResponsiveness.shouldFreezeInactiveTabs!('ios'), true);
  assert.equal(themeResponsiveness.shouldFreezeInactiveTabs!('android'), true);
  assert.equal(themeResponsiveness.shouldFreezeInactiveTabs!('web'), false);
});

test('o agendador é chamado sem vincular o objeto adaptador como contexto', () => {
  assert.equal(typeof themeResponsiveness.createDeferredThemeCommitter, 'function');

  let scheduled: (() => void) | null = null;
  const commits: ThemePreference[] = [];
  const committer = themeResponsiveness.createDeferredThemeCommitter!(
    (preference) => commits.push(preference),
    {
      request(this: unknown, callback: () => void) {
        assert.equal(this, undefined);
        scheduled = callback;
        return 1;
      },
      cancel(this: unknown) {
        assert.equal(this, undefined);
        scheduled = null;
      },
    }
  );

  committer.select('dark');
  assert.ok(scheduled);
  (scheduled as () => void)();
  assert.deepEqual(commits, []);
  assert.ok(scheduled);
  (scheduled as () => void)();
  assert.deepEqual(commits, ['dark']);
});

test('cada ciclo de hidratação invalida a persistência até sincronizar sua chave', () => {
  assert.equal(typeof themeResponsiveness.isThemePersistenceReady, 'function');
  assert.equal(typeof themeResponsiveness.getThemeHydrationMarker, 'function');

  const hydrationKey = '@kad/app-state/v2:guest';
  let marker: string | null = hydrationKey;
  assert.equal(
    themeResponsiveness.isThemePersistenceReady!(true, marker, hydrationKey),
    true
  );

  marker = themeResponsiveness.getThemeHydrationMarker!(false, hydrationKey);
  assert.equal(marker, null);
  assert.equal(
    themeResponsiveness.isThemePersistenceReady!(true, marker, hydrationKey),
    false
  );

  marker = themeResponsiveness.getThemeHydrationMarker!(true, hydrationKey);
  assert.equal(
    themeResponsiveness.isThemePersistenceReady!(true, marker, hydrationKey),
    true
  );
  assert.equal(
    themeResponsiveness.isThemePersistenceReady!(false, marker, hydrationKey),
    false
  );
});

test('reset troca a identidade sincronizada e não repersiste o tema removido', () => {
  assert.equal(typeof themeResponsiveness.isThemePersistenceReady, 'function');
  assert.equal(typeof themeResponsiveness.getThemeHydrationMarker, 'function');
  assert.equal(
    typeof themeResponsiveness.isThemeResetPersistencePending,
    'function'
  );

  const previousKey = '@kad/app-state/v2:guest:reset-0';
  const resetKey = '@kad/app-state/v2:guest:reset-1';
  let marker: string | null = previousKey;

  assert.equal(
    themeResponsiveness.isThemePersistenceReady!(true, marker, resetKey),
    false
  );

  marker = themeResponsiveness.getThemeHydrationMarker!(true, resetKey);
  assert.equal(
    themeResponsiveness.isThemePersistenceReady!(true, marker, resetKey),
    true
  );
  assert.equal(
    themeResponsiveness.isThemeResetPersistencePending!(1, 0),
    true
  );
  assert.equal(
    themeResponsiveness.isThemeResetPersistencePending!(1, 1),
    false
  );
});
