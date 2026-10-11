import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach } from 'vitest';
import { cleanup, configure } from '@testing-library/react';
import i18n from '../i18n';

// Role queries are slow in jsdom, so give async queries more time on busy CI machines.
configure({ asyncUtilTimeout: 5000 });

// jsdom has no ResizeObserver, which the drag and drop library uses to measure elements.
class ResizeObserverStub {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}
globalThis.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver;

beforeEach(async () => {
  if (i18n.isInitialized) await i18n.changeLanguage('en');
  window.localStorage.clear();
  window.location.hash = '';
  document.documentElement.dataset.theme = 'light';
});

afterEach(() => {
  cleanup();
});
