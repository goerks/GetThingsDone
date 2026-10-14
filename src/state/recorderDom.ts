/*
 * Reads the page for the test recorder (#37): what a user would call the element that was clicked, and where it is.
 * Plain DOM, no React, so it can be used from the event listeners.
 */

export const RECORDER_ATTR = 'data-recorder';
export const HOVER_ATTR = 'data-recorder-hover';

const INTERACTIVE =
  'button, a[href], [role="button"], [role="tab"], [role="menuitem"], [role="option"], [role="checkbox"], [role="switch"], input, select, textarea, summary, label, [data-story-id]';

function clean(text: string | null | undefined, max = 60): string {
  const flat = (text ?? '').replace(/\s+/g, ' ').trim();
  return flat.length > max ? `${flat.slice(0, max - 1).trimEnd()}…` : flat;
}

/** The text of an element with a space between its parts, so a card reads "S-3 Reorder the backlog", not "S-3Reorder the backlog". */
function spacedText(element: Element): string {
  const parts: string[] = [];
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const text = node.textContent?.trim();
    if (text) parts.push(text);
  }
  return parts.join(' ');
}

function textOfIds(ids: string | null): string {
  if (!ids) return '';
  return clean(
    ids
      .split(/\s+/)
      .map((id) => (document.getElementById(id) ? spacedText(document.getElementById(id) as Element) : ''))
      .join(' ')
  );
}

export type Kind = 'field' | 'card' | 'control' | 'other';

export interface Described {
  name: string;
  kind: Kind;
  element: Element;
}

export function isField(element: Element): element is HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement {
  return element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement || element instanceof HTMLSelectElement;
}

/** The label a person would use for a field: its label text, its aria-label, or its placeholder. */
export function fieldName(field: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement): string {
  return (
    clean(field.getAttribute('aria-label')) ||
    textOfIds(field.getAttribute('aria-labelledby')) ||
    clean(field.labels?.[0] ? spacedText(field.labels[0]) : '') ||
    clean(field.getAttribute('placeholder')) ||
    clean(field.getAttribute('name'))
  );
}

/** The element that was meant (the button around an icon, the control behind a label) and what to call it. */
export function describe(target: EventTarget | null): Described | null {
  if (!(target instanceof Element)) return null;
  let element: Element = target.closest(INTERACTIVE) ?? target;
  if (element instanceof HTMLLabelElement && element.control) element = element.control;
  if (isField(element)) return { name: fieldName(element), kind: 'field', element };
  const name =
    clean(element.getAttribute('aria-label')) ||
    textOfIds(element.getAttribute('aria-labelledby')) ||
    clean(element.getAttribute('title')) ||
    clean(spacedText(element));
  const kind: Kind = element.hasAttribute('data-story-id') ? 'card' : element.matches(INTERACTIVE) ? 'control' : 'other';
  return { name, kind, element };
}

/** The part of the page an element is in: the column or the sprint with its heading. Empty when there is none. */
export function placeOf(element: Element): string {
  const region = element.closest('[aria-labelledby]');
  return region ? textOfIds(region.getAttribute('aria-labelledby')) : '';
}

/** The visible text of an element, shortened. */
export function textContent(element: Element): string {
  return clean(spacedText(element), 80);
}

export function inRecorder(target: EventTarget | null): boolean {
  return target instanceof Element && target.closest(`[${RECORDER_ATTR}]`) !== null;
}
