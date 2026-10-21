import { useEffect, useRef } from 'react';
import type { SyncTrigger } from '../domain/types';
import { AUTO_INTERVAL_MS, autoTick, type AutoState } from '../domain/syncLog';
import { useApp } from '../state/AppState';
import { useFeature } from './useFeature';

/** How often the timer looks whether a run is due, in milliseconds. */
export const AUTO_LOOK_MS = 5000;

/** No dialog is open and nobody is typing: a run that would change the screen under the PO's hands waits. */
export function isIdle(): boolean {
  if (document.querySelector('[role="dialog"], dialog[open]')) return false;
  const active = document.activeElement;
  if (!active) return true;
  const tag = active.tagName;
  return !(tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (active as HTMLElement).isContentEditable);
}

/**
 * The automatic sync of all issues (#30, #66): a run when the app starts and when it comes back to the front, and one every
 * 15 minutes while it is open. It renders nothing and only works while the feature, the connection and the switch are on.
 */
export function SyncAuto() {
  const app = useApp();
  const featureOn = useFeature('sync');
  const { auto, connection, service } = app.settings.sync;
  const active = featureOn && auto && Object.keys(connection).length > 0 && !app.loading;
  const latest = useRef(app);
  latest.current = app;

  useEffect(() => {
    if (!active) return;
    // The first look is the start of the app (or the moment the switch went on): a run is due at once.
    let state: AutoState = { nextAt: Date.now() + AUTO_INTERVAL_MS, due: true };
    let trigger: SyncTrigger = 'start';
    let running = false;
    const look = async (): Promise<void> => {
      if (running) return;
      const { syncState, syncTokens, syncNow, setSyncNextRun } = latest.current;
      const result = autoTick(state, { now: Date.now(), idle: isIdle(), online: navigator.onLine !== false, paused: syncState.paused });
      state = result.state;
      setSyncNextRun(state.nextAt);
      if (!result.run) return;
      // Without a token (the browser forgets it with the session) there is nothing to run with.
      if (!(await syncTokens.get())) return;
      const used = trigger;
      trigger = 'auto';
      running = true;
      try {
        await syncNow(undefined, used);
      } finally {
        running = false;
      }
    };
    // Coming back to the front or to the network is like a start.
    const markStart = (): void => {
      trigger = 'start';
      state = { ...state, due: true };
    };
    const onVisible = (): void => {
      if (document.visibilityState === 'visible') markStart();
    };
    const timer = setInterval(() => void look(), AUTO_LOOK_MS);
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('online', markStart);
    void look();
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('online', markStart);
    };
    // The service is part of the key: another service starts its own timer.
  }, [active, service]);

  return null;
}
