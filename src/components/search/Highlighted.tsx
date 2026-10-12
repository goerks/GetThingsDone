import type { Range } from '../../domain/search';

/** Text with the matched ranges marked. */
export function Highlighted({ text, ranges }: { text: string; ranges: readonly Range[] }) {
  if (ranges.length === 0) return <>{text}</>;
  const parts: React.ReactNode[] = [];
  let at = 0;
  ranges.forEach((range, index) => {
    if (range.start > at) parts.push(text.slice(at, range.start));
    parts.push(<mark key={index}>{text.slice(range.start, range.end)}</mark>);
    at = range.end;
  });
  if (at < text.length) parts.push(text.slice(at));
  return <>{parts}</>;
}
