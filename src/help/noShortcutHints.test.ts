import { describe, expect, it } from 'vitest';
import de from '../i18n/de.json';
import en from '../i18n/en.json';
import fr from '../i18n/fr.json';
import it_ from '../i18n/it.json';

type Topic = { title: string; keywords?: string; body: string };

/** Topics that explain the shortcuts themselves; they may name keys (#55). The first steps belong to the PO and are not checked here. */
const MAY_NAME_KEYS = new Set(['shortcuts', 'tour']);

describe('help texts without shortcut hints (#55)', () => {
  for (const [language, resource] of Object.entries({ en, de, fr, it: it_ })) {
    it(`AC8.4 no help topic in ${language} names a key combination, except the shortcut overview`, () => {
      // Given the help topics of a language
      const topics = resource.help.topics as unknown as Record<string, Topic>;
      // When I read all topics but the shortcut overview
      const texts = Object.entries(topics)
        .filter(([id]) => !MAY_NAME_KEYS.has(id))
        .map(([id, topic]) => [id, topic.body] as const);
      // Then none of them names Ctrl, Strg or Cmd
      for (const [id, body] of texts) expect(body, `${language}: ${id}`).not.toMatch(/Ctrl|Strg|Cmd|⌘/);
      // And the shortcut overview is still there
      expect(topics['shortcuts']?.body).toMatch(/Ctrl|Strg/);
    });
  }
});
