import { describe, expect, it } from 'vitest';
import { diffText } from './textDiff';

const text = (pieces: Array<{ text: string }> | undefined): string => (pieces ?? []).map((piece) => piece.text).join('');

describe('text diff', () => {
  it('AC8.2 puts equal lines on both sides and marks the changed words of a changed line', () => {
    // Given two versions of a description
    const before = 'Als Nutzer will ich mich anmelden,\ndamit ich meine Aufgaben sehe. Anmeldung mit E-Mail.\nNicht Teil: Registrierung.';
    const after =
      'Als Nutzer will ich mich anmelden,\ndamit ich meine Aufgaben sehe. Anmeldung mit E-Mail und Passwort.\nEin vergessenes Passwort kann ich per E-Mail zurücksetzen.\nNicht Teil: Registrierung.';
    // When they are compared line by line
    const rows = diffText(before, after);
    // Then the first line is the same, the second is changed with the new words marked, the third only exists on the right
    expect(rows.map((row) => row.kind)).toEqual(['same', 'change', 'change', 'same']);
    expect(rows[1].left?.pieces.filter((piece) => piece.mark).map((piece) => piece.text)).toEqual([]);
    expect(rows[1].right?.pieces.filter((piece) => piece.mark).map((piece) => piece.text.trim())).toEqual(['und Passwort']);
    expect(rows[2].left).toBeNull();
    expect(text(rows[2].right?.pieces)).toBe('Ein vergessenes Passwort kann ich per E-Mail zurücksetzen.');
    // And line numbers follow each side's own text
    expect(rows[3].left?.no).toBe(3);
    expect(rows[3].right?.no).toBe(4);
  });

  it('shows a removed line opposite an empty side', () => {
    // Given a line that is gone
    const rows = diffText('a\nb\nc', 'a\nc');
    // Then the left side has it and the right side is empty
    expect(rows.map((row) => [row.kind, row.left && text(row.left.pieces), row.right && text(row.right.pieces)])).toEqual([
      ['same', 'a', 'a'],
      ['change', 'b', null],
      ['same', 'c', 'c']
    ]);
  });

  it('handles empty texts', () => {
    // Given an empty and a filled text
    // Then every line is added, or removed
    expect(diffText('', 'neu').map((row) => [row.left, row.right && text(row.right.pieces)])).toEqual([[null, 'neu']]);
    expect(diffText('alt', '').map((row) => [row.left && text(row.left.pieces), row.right])).toEqual([['alt', null]]);
    expect(diffText('', '')).toEqual([]);
  });
});
