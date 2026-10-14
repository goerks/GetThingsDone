import { describe, expect, it } from 'vitest';
import { acceptanceEnabled, isPreviewHost } from './preview';

describe('acceptance panel visibility', () => {
  it('AC11.5 recognises the pull request previews and nothing else', () => {
    expect(isPreviewHost('getthingsdone-pr-32.onrender.com')).toBe(true);
    expect(isPreviewHost('getthingsdone.onrender.com')).toBe(false);
    expect(isPreviewHost('example.com')).toBe(false);
  });

  it('AC11.5 shows in a preview, with ?acceptance=1, never in the desktop app and not on main', () => {
    expect(acceptanceEnabled({ hostname: 'getthingsdone-pr-32.onrender.com', search: '' }, false)).toBe(true);
    expect(acceptanceEnabled({ hostname: 'localhost', search: '?acceptance=1' }, false)).toBe(true);
    expect(acceptanceEnabled({ hostname: 'getthingsdone-pr-32.onrender.com', search: '?acceptance=1' }, true)).toBe(false);
    expect(acceptanceEnabled({ hostname: 'getthingsdone.onrender.com', search: '' }, false)).toBe(import.meta.env.DEV);
  });
});
