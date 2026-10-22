import { useContext } from 'react';
import type { Epic } from '../domain/types';
import { DetailsContextForTag } from '../state/Details';
import { useBuiltin } from './useBuiltin';
import { BareButton } from '../ui';

interface Props {
  epic: Epic | undefined;
  /** Inside a card or row the card is the keyboard stop, so the tag is reachable by mouse only. */
  inCard?: boolean;
}

/** Epic name with a small colour dot; a click opens the epic. The name is always shown, colour never carries meaning alone. */
export function EpicTag({ epic, inCard = false }: Props) {
  const details = useContext(DetailsContextForTag);
  const builtin = useBuiltin();
  if (!epic) return null;
  const content = (
    <>
      {builtin.shown('epic', 'color') && (
        <span className="epic__dot" style={{ background: `var(--epic-${epic.colorKey})` }} aria-hidden="true" />
      )}
      {epic.name}
    </>
  );
  if (!details) return <span className="epic">{content}</span>;
  return (
    <BareButton
      type="button"
      className="epic epic--button"
      tabIndex={inCard ? -1 : undefined}
      onClick={(event) => {
        event.stopPropagation();
        details.openEpic(epic.id);
      }}
      onDoubleClick={(event) => event.stopPropagation()}
    >
      {content}
    </BareButton>
  );
}
