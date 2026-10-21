import { useEffect, useId, useRef, useState, type KeyboardEvent, type SyntheticEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { parsePoints } from '../domain/board';
import type { Story } from '../domain/types';
import { useApp } from '../state/AppState';
import { useBuiltin } from './useBuiltin';
import { useStoryKey } from './useStoryKey';

/** Keeps a press in the points editor from picking up the row (drag) or opening the story. */
const keepHere = (event: SyntheticEvent): void => event.stopPropagation();

/**
 * The round story points of a backlog row, directly editable (#55). A click or Enter turns them into an input;
 * Enter or leaving the field saves, Escape cancels. Invalid input is not saved and shows a hint.
 */
export function PointsEdit({ story }: { story: Story }) {
  const { t } = useTranslation();
  const app = useApp();
  const keyOf = useStoryKey();
  const builtin = useBuiltin();
  const hintId = useId();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [invalid, setInvalid] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const returnFocus = useRef(false);
  const label = builtin.label('points', t('detail.points'));
  const name = t('backlog.pointsInput', { label, code: keyOf(story) });

  useEffect(() => {
    if (!editing && returnFocus.current) {
      returnFocus.current = false;
      buttonRef.current?.focus();
    }
  }, [editing]);

  const stop = (focusButton: boolean): void => {
    returnFocus.current = focusButton;
    setEditing(false);
    setInvalid(false);
  };

  const save = (focusButton: boolean): void => {
    const value = parsePoints(draft);
    if (value === null) {
      // Enter keeps the field open with the hint; leaving the field gives the old value back.
      if (focusButton) setInvalid(true);
      else stop(false);
      return;
    }
    if (value !== story.points) app.updateStory(story.id, { points: value });
    stop(focusButton);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    event.stopPropagation();
    if (event.key === 'Escape') {
      event.preventDefault();
      stop(true);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      save(true);
    }
  };

  if (editing) {
    return (
      <span className="points-edit" onClick={keepHere} onDoubleClick={keepHere}>
        <input
          className="input points-edit__input"
          inputMode="numeric"
          autoComplete="off"
          autoFocus
          value={draft}
          aria-label={name}
          aria-invalid={invalid}
          aria-describedby={invalid ? hintId : undefined}
          onFocus={(event) => event.currentTarget.select()}
          onChange={(event) => {
            setDraft(event.target.value);
            setInvalid(false);
          }}
          onBlur={() => save(false)}
          onKeyDown={onKeyDown}
          onPointerDown={keepHere}
          onMouseDown={keepHere}
          onTouchStart={keepHere}
        />
        {invalid && (
          <span id={hintId} className="points-edit__hint" role="alert">
            {t('backlog.pointsInvalid')}
          </span>
        )}
      </span>
    );
  }

  return (
    <button
      ref={buttonRef}
      type="button"
      className="pill pill--edit"
      title={builtin.pointsTitle(story.points)}
      onPointerDown={keepHere}
      onClick={(event) => {
        event.stopPropagation();
        setDraft(String(story.points));
        setEditing(true);
      }}
      onDoubleClick={keepHere}
      onKeyDown={(event) => event.stopPropagation()}
    >
      {story.points}
      <span className="sr-only"> – {t('edit.action', { field: name })}</span>
    </button>
  );
}
