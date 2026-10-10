import type { Epic } from '../domain/types';

/** Epic name with a small colour dot. The name is always shown, colour never carries meaning alone. */
export function EpicTag({ epic }: { epic: Epic | undefined }) {
  if (!epic) return null;
  return (
    <span className="epic">
      <span className="epic__dot" style={{ background: `var(--epic-${epic.colorKey})` }} aria-hidden="true" />
      {epic.name}
    </span>
  );
}
