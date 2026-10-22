import { useRef, useState, type KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { defaultValuesFor, missingRequired } from '../domain/fields';
import { useApp } from '../state/AppState';
import { NewStoryDialog } from './NewStoryDialog';
import { TextInput } from '../ui';

interface QuickAddProps {
  /** Where the story lands, in words ("In progress", "Sprint 2"); part of the accessible names. */
  place: string;
  /** "row": a wide "+ Story" row under a column or section. "cell": the small "+" of a story map cell. */
  variant?: 'row' | 'cell';
  /** Replaces the accessible name of the button (the story map names the cell). */
  buttonLabel?: string;
  /** More classes for the button, such as the empty-cell look of the story map. */
  extraClass?: string;
  /** Called with the title when Enter is pressed on a non-empty field. The field stays open for the next one. */
  onAdd: (title: string) => void;
}

/**
 * "+ Story": a button that turns into a title field. Enter adds the story and keeps the field for the next one,
 * Escape closes it (#32, Q2). Only the title is asked; everything else follows the place or the defaults.
 */
export function QuickAdd({ place, variant = 'row', buttonLabel, extraClass, onAdd }: QuickAddProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const button = useRef<HTMLButtonElement>(null);
  const returnFocus = useRef(false);

  const close = (focusButton: boolean): void => {
    returnFocus.current = focusButton;
    setOpen(false);
    setTitle('');
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      close(true);
    } else if (event.key === 'Enter' && !event.ctrlKey && !event.metaKey) {
      event.preventDefault();
      event.stopPropagation();
      const value = title.trim();
      if (!value) return;
      onAdd(value);
      setTitle('');
    }
  };

  if (!open) {
    return (
      <button
        type="button"
        ref={(node) => {
          button.current = node;
          if (node && returnFocus.current) {
            returnFocus.current = false;
            node.focus();
          }
        }}
        className={`${variant === 'cell' ? 'map-cell__add quick-add--cell' : 'quick-add'}${extraClass ? ` ${extraClass}` : ''}`}
        aria-label={buttonLabel}
        title={buttonLabel ?? t('quickAdd.open', { place })}
        onClick={() => setOpen(true)}
      >
        {variant === 'cell' ? (
          '+'
        ) : (
          <>
            {t('quickAdd.button')}{' '}
            <span className="sr-only">{t('quickAdd.in', { place })}</span>
          </>
        )}
      </button>
    );
  }

  return (
    // The open field is as high as the button it replaces, so the page does not shift when a field closes on blur.
    <div className="quick-add quick-add--open">
      <TextInput
        className="quick-add__input"
        aria-label={t('quickAdd.input', { place })}
        placeholder={t('quickAdd.placeholder')}
        value={title}
        autoFocus
        onChange={(event) => setTitle(event.target.value)}
        onKeyDown={onKeyDown}
        onBlur={() => !title.trim() && close(false)}
      />
    </div>
  );
}

interface StoryQuickAddProps extends Omit<QuickAddProps, 'onAdd'> {
  sprintId: string | null;
  epicId?: string | null;
  /** Set on the release rows of the story map. */
  releaseId?: string | null;
  /** The status the story starts in (a board column); otherwise the first status of "not started". */
  status?: string;
}

/**
 * Quick add for stories. When a required custom field has no default, a title alone cannot make a valid story:
 * the full "New story" dialog opens then, with the title filled in and the missing field marked.
 */
export function StoryQuickAdd({ sprintId, epicId = null, releaseId, status, ...rest }: StoryQuickAddProps) {
  const app = useApp();
  const [pending, setPending] = useState<string | null>(null);

  const add = (title: string): void => {
    const values = defaultValuesFor('story', app.fields, app.assignments);
    if (missingRequired('story', app.fields, app.assignments, values).length > 0) {
      setPending(title);
      return;
    }
    app.createStory({ title, description: '', epicId, points: 3, sprintId, releaseId: releaseId ?? null, values, status });
  };

  return (
    <>
      <QuickAdd {...rest} onAdd={add} />
      {pending !== null && (
        <NewStoryDialog sprintId={sprintId} epicId={epicId} releaseId={releaseId} initialTitle={pending} status={status} flagMissing onClose={() => setPending(null)} />
      )}
    </>
  );
}
