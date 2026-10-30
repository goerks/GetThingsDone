import { newId } from '../../domain/ids';

/*
 * The text of a Jira issue is a document in the Atlassian Document Format (ADF), not Markdown (#66, ADR 0008). The app
 * keeps plain text and a list of criteria, so this module turns an ADF document into them and back. The criteria are the
 * task list under the heading "Acceptance criteria" (the same convention as on GitHub). Whatever the app cannot show
 * (tables, images, panels, marks such as bold or links) makes the document `lossy`: it can still be read, but the sync
 * never writes the description of such an issue (it only changes the task list, which keeps all other nodes as they are).
 */

export interface AdfMark {
  type: string;
  attrs?: Record<string, unknown>;
}

export interface AdfNode {
  type: string;
  attrs?: Record<string, unknown>;
  content?: AdfNode[];
  text?: string;
  marks?: AdfMark[];
}

export interface AdfDoc {
  version: 1;
  type: 'doc';
  content: AdfNode[];
}

export interface ParsedCriterion {
  text: string;
  done: boolean;
}

const CRITERIA_HEADING = /^(acceptance criteria|akzeptanzkriterien|abnahmekriterien)\s*:?$/i;
const CRITERIA_TITLE = 'Acceptance criteria';

export const emptyDoc = (): AdfDoc => ({ version: 1, type: 'doc', content: [] });

/** Whether a value looks like an ADF document. */
export const isAdf = (value: unknown): value is AdfDoc => typeof value === 'object' && value !== null && (value as AdfDoc).type === 'doc' && Array.isArray((value as AdfDoc).content);

interface ReadState {
  lossy: boolean;
}

/** All the text in a node, without any structure. */
function deepText(node: AdfNode): string {
  if (node.text !== undefined) return node.text;
  const own = (node.attrs?.text ?? node.attrs?.shortName ?? node.attrs?.url ?? '') as string;
  return [own, ...(node.content ?? []).map(deepText)].filter((part) => part !== '').join(' ');
}

/** The text of inline nodes. A mark, a mention, an emoji or an image cannot be written back, so the document becomes lossy. */
function inlineText(nodes: readonly AdfNode[] | undefined, state: ReadState): string {
  let out = '';
  for (const node of nodes ?? []) {
    if (node.type === 'text') {
      if ((node.marks ?? []).length > 0) state.lossy = true;
      out += node.text ?? '';
    } else if (node.type === 'hardBreak') {
      out += '\n';
    } else {
      state.lossy = true;
      out += deepText(node);
    }
  }
  return out;
}

const trimEnd = (lines: string[]): string => lines.join('\n').replace(/\s+$/, '');

/** One block as text (its lines joined by a line break). */
function blockText(node: AdfNode, state: ReadState): string {
  switch (node.type) {
    case 'paragraph':
      return trimEnd([inlineText(node.content, state)]);
    case 'heading':
      return `${'#'.repeat(Math.min(6, Math.max(1, Number(node.attrs?.level ?? 1))))} ${inlineText(node.content, state)}`;
    case 'bulletList':
    case 'orderedList':
      return (node.content ?? [])
        .map((item, index) => {
          const parts = item.content ?? [];
          // A list inside a list, or anything but paragraphs, is more than the text can hold.
          if (parts.some((part) => part.type !== 'paragraph')) state.lossy = true;
          const text = parts.map((part) => (part.type === 'paragraph' ? inlineText(part.content, state) : deepText(part))).join(' ');
          return node.type === 'bulletList' ? `- ${text}` : `${index + 1}. ${text}`;
        })
        .join('\n');
    case 'taskList':
      return (node.content ?? []).map((item) => `- [${item.attrs?.state === 'DONE' ? 'x' : ' '}] ${inlineText(item.content, state)}`).join('\n');
    case 'codeBlock': {
      const language = typeof node.attrs?.language === 'string' ? node.attrs.language : '';
      return `\`\`\`${language}\n${(node.content ?? []).map((part) => part.text ?? '').join('')}\n\`\`\``;
    }
    case 'rule':
      return '---';
    case 'blockquote': {
      const parts = node.content ?? [];
      if (parts.some((part) => part.type !== 'paragraph')) state.lossy = true;
      return parts.map((part) => `> ${part.type === 'paragraph' ? inlineText(part.content, state) : deepText(part)}`).join('\n');
    }
    default:
      // A table, an image, a panel, an expander: it cannot be written back.
      state.lossy = true;
      return deepText(node);
  }
}

const headingText = (node: AdfNode): string => (node.content ?? []).map((part) => part.text ?? '').join('').trim();

/** The index of the heading "Acceptance criteria" in the top level of a document, or -1. */
function criteriaHeadingAt(content: readonly AdfNode[]): number {
  return content.findIndex((node) => node.type === 'heading' && CRITERIA_HEADING.test(headingText(node)));
}

/** The nodes after the heading up to the next heading, as indexes of the top level. */
function sectionOf(content: readonly AdfNode[], start: number): { first: number; end: number } {
  let end = content.length;
  for (let index = start + 1; index < content.length; index += 1) {
    if (content[index].type === 'heading') {
      end = index;
      break;
    }
  }
  return { first: start + 1, end };
}

/**
 * The description and the criteria of a document. The task items under the heading "Acceptance criteria" are the
 * criteria and are left out of the description together with their heading; without such a heading, or without tasks
 * under it, there are no criteria and everything is the description.
 */
export function readAdf(doc: AdfDoc | null | undefined): { description: string; criteria: ParsedCriterion[]; lossy: boolean } {
  const state: ReadState = { lossy: false };
  const content = doc?.content ?? [];
  const heading = criteriaHeadingAt(content);
  const criteria: ParsedCriterion[] = [];
  const skip = new Set<number>();
  if (heading >= 0) {
    const { first, end } = sectionOf(content, heading);
    const lists = content.slice(first, end).flatMap((node, offset) => (node.type === 'taskList' ? [first + offset] : []));
    for (const index of lists) {
      for (const item of content[index].content ?? []) criteria.push({ text: inlineText(item.content, state).trim(), done: item.attrs?.state === 'DONE' });
    }
    if (criteria.length > 0) {
      skip.add(heading);
      for (const index of lists) skip.add(index);
    }
  }
  const blocks = content.flatMap((node, index) => (skip.has(index) ? [] : [blockText(node, state)]));
  return { description: blocks.filter((block) => block.trim() !== '').join('\n\n').trim(), criteria, lossy: state.lossy };
}

/* ---------- Text to ADF ---------- */

const text = (value: string): AdfNode[] => (value === '' ? [] : [{ type: 'text', text: value }]);

/** Inline nodes of lines that belong to one paragraph: the lines are separated by a hard break. */
function inlineLines(lines: readonly string[]): AdfNode[] {
  const out: AdfNode[] = [];
  lines.forEach((line, index) => {
    if (index > 0) out.push({ type: 'hardBreak' });
    out.push(...text(line));
  });
  return out;
}

const paragraph = (lines: readonly string[]): AdfNode => ({ type: 'paragraph', content: inlineLines(lines) });
const listItem = (value: string): AdfNode => ({ type: 'listItem', content: [{ type: 'paragraph', content: text(value) }] });

const taskList = (items: ReadonlyArray<ParsedCriterion>, idOf: () => string): AdfNode => ({
  type: 'taskList',
  attrs: { localId: idOf() },
  content: items.map((item) => ({ type: 'taskItem', attrs: { localId: idOf(), state: item.done ? 'DONE' : 'TODO' }, content: text(item.text) }))
});

/** The nodes for a plain text: paragraphs, headings (`#`), bullet and numbered lists, task lists (`- [ ]`), quotes (`>`), code fences and rules. */
export function textToNodes(source: string, idOf: () => string = newId): AdfNode[] {
  const lines = source.replace(/\r\n?/g, '\n').split('\n');
  const nodes: AdfNode[] = [];
  let para: string[] = [];
  const flush = (): void => {
    if (para.length > 0) nodes.push(paragraph(para));
    para = [];
  };
  let index = 0;
  while (index < lines.length) {
    const line = lines[index];
    const fence = /^```(.*)$/.exec(line);
    if (fence) {
      flush();
      const body: string[] = [];
      index += 1;
      while (index < lines.length && !/^```\s*$/.test(lines[index])) {
        body.push(lines[index]);
        index += 1;
      }
      const language = fence[1].trim();
      nodes.push({ type: 'codeBlock', ...(language ? { attrs: { language } } : {}), content: text(body.join('\n')) });
      index += 1;
      continue;
    }
    if (line.trim() === '') {
      flush();
      index += 1;
      continue;
    }
    const heading = /^(#{1,6})\s+(.*)$/.exec(line);
    if (heading) {
      flush();
      nodes.push({ type: 'heading', attrs: { level: heading[1].length }, content: text(heading[2].trim()) });
      index += 1;
      continue;
    }
    if (/^(-{3,}|\*{3,})\s*$/.test(line)) {
      flush();
      nodes.push({ type: 'rule' });
      index += 1;
      continue;
    }
    // A run of lines of the same kind is one list (or one quote).
    const kind = (candidate: string): 'task' | 'bullet' | 'ordered' | 'quote' | null =>
      /^\s*[-*+]\s+\[[ xX]\]\s+/.test(candidate) ? 'task' : /^\s*[-*+]\s+/.test(candidate) ? 'bullet' : /^\s*\d+[.)]\s+/.test(candidate) ? 'ordered' : /^>/.test(candidate) ? 'quote' : null;
    const first = kind(line);
    if (first) {
      flush();
      const run: string[] = [];
      while (index < lines.length && kind(lines[index]) === first) {
        run.push(lines[index]);
        index += 1;
      }
      if (first === 'task') {
        nodes.push(taskList(run.map((entry) => ({ text: /^\s*[-*+]\s+\[[ xX]\]\s+(.*)$/.exec(entry)?.[1].trim() ?? '', done: /\[[xX]\]/.test(entry) }) as ParsedCriterion), idOf));
      } else if (first === 'bullet') {
        nodes.push({ type: 'bulletList', content: run.map((entry) => listItem(/^\s*[-*+]\s+(.*)$/.exec(entry)?.[1].trim() ?? '')) });
      } else if (first === 'ordered') {
        nodes.push({ type: 'orderedList', content: run.map((entry) => listItem(/^\s*\d+[.)]\s+(.*)$/.exec(entry)?.[1].trim() ?? '')) });
      } else {
        nodes.push({ type: 'blockquote', content: [paragraph(run.map((entry) => entry.replace(/^>\s?/, '')))] });
      }
      continue;
    }
    para.push(line);
    index += 1;
  }
  flush();
  return nodes;
}

const criteriaHeading = (): AdfNode => ({ type: 'heading', attrs: { level: 2 }, content: text(CRITERIA_TITLE) });

/** A document made from a description and criteria: the description, then the task list under its heading. */
export function composeAdf(description: string, criteria: ReadonlyArray<ParsedCriterion>, idOf: () => string = newId): AdfDoc {
  const content = textToNodes(description.trim(), idOf);
  if (criteria.length > 0) content.push(criteriaHeading(), taskList(criteria, idOf));
  return { version: 1, type: 'doc', content };
}

/**
 * The document with other criteria: the task list under the heading is replaced and every other node stays as it is
 * (also those the app cannot show); without a heading the section is added at the end, and an emptied section goes.
 */
export function withCriteriaAdf(doc: AdfDoc | null | undefined, criteria: ReadonlyArray<ParsedCriterion>, idOf: () => string = newId): AdfDoc {
  const content = [...(doc?.content ?? [])];
  const heading = criteriaHeadingAt(content);
  if (heading < 0) {
    if (criteria.length > 0) content.push(criteriaHeading(), taskList(criteria, idOf));
    return { version: 1, type: 'doc', content };
  }
  const { first, end } = sectionOf(content, heading);
  const rest = content.slice(first, end).filter((node) => node.type !== 'taskList');
  const section = criteria.length > 0 ? [content[heading], taskList(criteria, idOf), ...rest] : rest;
  return { version: 1, type: 'doc', content: [...content.slice(0, heading), ...section, ...content.slice(end)] };
}
