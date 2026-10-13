import { describe, expect, it } from 'vitest';
import de from '../i18n/de.json';
import en from '../i18n/en.json';
import fr from '../i18n/fr.json';
import it_ from '../i18n/it.json';
import { searchHelp, type HelpEntry } from '../domain/helpSearch';
import { TOUR_STEPS } from '../domain/helpTour';
import { TOPICS, TOUR_TOPIC_ID } from './topics';

const languages = [
  ['de', de],
  ['en', en],
  ['fr', fr],
  ['it', it_]
] as const;

type HelpTexts = typeof en.help;

const entriesOf = (help: HelpTexts): HelpEntry[] =>
  [...TOPICS.map((topic) => topic.id), TOUR_TOPIC_ID].map((id) => {
    const text = (help.topics as Record<string, { title: string; keywords: string; body: string }>)[id];
    return { id, title: text.title, keywords: text.keywords, body: text.body };
  });

describe.each(languages)('help topics in %s', (code, file) => {
  const help = file.help as HelpTexts;
  const entries = entriesOf(help);

  it('AC9.1 has a title, keywords and text for every topic', () => {
    for (const entry of entries) {
      expect(entry.title.trim(), `${code} ${entry.id} title`).not.toBe('');
      expect(entry.keywords.trim(), `${code} ${entry.id} keywords`).not.toBe('');
      expect(entry.body.trim(), `${code} ${entry.id} body`).not.toBe('');
    }
  });

  it('AC9.1 has the texts of every step of the first steps', () => {
    for (const id of TOUR_STEPS) {
      const step = help.tour.steps[id];
      expect(step.title.trim()).not.toBe('');
      expect(step.text.trim()).not.toBe('');
    }
  });

  it('AC3.7 finds every topic by its own title, and lists it first or among the first', () => {
    for (const entry of entries) {
      const ids = searchHelp(entries, entry.title).map((hit) => hit.id);
      expect(ids, `${code}: "${entry.title}"`).toContain(entry.id);
      expect(ids[0], `${code}: "${entry.title}" comes first`).toBe(entry.id);
    }
  });

  it('AC3.2 finds every topic by its title without accents and in capitals', () => {
    for (const entry of entries) {
      const plain = entry.title.normalize('NFD').replace(/\p{M}/gu, '').toUpperCase();
      expect(searchHelp(entries, plain).map((hit) => hit.id), `${code}: "${plain}"`).toContain(entry.id);
    }
  });

  it('AC3.1 finds every topic by each word of its keywords', () => {
    for (const entry of entries) {
      for (const word of entry.keywords.split(/\s+/).filter(Boolean)) {
        expect(searchHelp(entries, word).map((hit) => hit.id), `${code}: "${word}"`).toContain(entry.id);
      }
    }
  });

  it('AC2.1 names every page', () => {
    for (const page of ['board', 'backlog', 'map', 'epics', 'releases', 'settings'] as const) {
      expect(help.pages[page].trim()).not.toBe('');
    }
  });
});

describe('help topics', () => {
  it('has no topic id twice', () => {
    const ids = [...TOPICS.map((topic) => topic.id), TOUR_TOPIC_ID];
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('AC2.1 lists topics on every page, with the general ones on all of them', () => {
    for (const page of ['board', 'backlog', 'map', 'epics', 'releases', 'settings'] as const) {
      expect(TOPICS.filter((topic) => !topic.general && topic.pages.includes(page)).length, page).toBeGreaterThan(0);
      expect(TOPICS.filter((topic) => topic.general).every((topic) => topic.pages.includes(page))).toBe(true);
    }
  });

  it('AC3.6 offers the German word "Sprintlinie" and the word "Tastenkürzel" as topics', () => {
    const german = entriesOf(de.help as HelpTexts);
    expect(searchHelp(german, 'Sprintlinie')[0]?.id).toBe('backlog.sprints');
    expect(searchHelp(german, 'tastenkurzel')[0]?.id).toBe('shortcuts');
    expect(searchHelp(german, 'status')[0]?.id).toBe('board.columns');
    expect(searchHelp(german, 'verschieben')[0]?.id).toBe('board.move');
    expect(searchHelp(german, 'rundgang')[0]?.id).toBe(TOUR_TOPIC_ID);
  });
});
