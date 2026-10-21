import { useId, useState, type KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { searchStories } from '../domain/storySearch';
import type { Story } from '../domain/types';
import { useStoryKey } from './useStoryKey';

/** At most this many matches are listed; the rest is reached by typing more. */
const LIMIT = 8;

interface Props {
  /** The stories that can be picked. */
  stories: readonly Story[];
  onPick: (story: Story) => void;
}

/**
 * Picks a story by full-text search in its key and title (an accessible combobox with a listbox).
 * Typing narrows the list; arrow keys move, Enter or a click picks, Escape closes the list. Focus stays in
 * the field after a pick, so several stories can be added one after the other.
 */
export function StoryPicker({ stories, onPick }: Props) {
  const { t } = useTranslation();
  const uid = useId();
  const keyOf = useStoryKey();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [added, setAdded] = useState('');

  const matches = searchStories(stories, query);
  const shown = matches.slice(0, LIMIT);
  const listId = `${uid}-list`;
  const optionId = (index: number): string => `${uid}-option-${index}`;
  const expanded = open && shown.length > 0;
  const current = Math.min(active, Math.max(shown.length - 1, 0));

  const pick = (story: Story): void => {
    onPick(story);
    setAdded(t('releases.picker.added', { code: keyOf(story) }));
    setQuery('');
    setActive(0);
    setOpen(false);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      if (!open) setOpen(true);
      else setActive((index) => Math.min(index + 1, shown.length - 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setOpen(true);
      setActive((index) => Math.max(index - 1, 0));
    } else if (event.key === 'Enter') {
      // The field sits in a dialog that may hold a form, so Enter never submits anything here.
      event.preventDefault();
      if (expanded) pick(shown[current]);
    } else if (event.key === 'Escape' && open) {
      // Closes the list only; a second Escape closes the dialog.
      event.preventDefault();
      event.stopPropagation();
      setOpen(false);
    }
  };

  if (stories.length === 0) return <p className="muted">{t('releases.noStoriesToAdd')}</p>;

  return (
    <div className="story-picker">
      <label htmlFor={`${uid}-input`} className="sr-only">
        {t('releases.addStory')}
      </label>
      <input
        id={`${uid}-input`}
        className="input story-picker__input"
        type="text"
        role="combobox"
        autoComplete="off"
        placeholder={t('releases.picker.placeholder')}
        aria-expanded={expanded}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={expanded ? optionId(current) : undefined}
        value={query}
        onChange={(event) => {
          setQuery(event.target.value);
          setActive(0);
          setOpen(true);
          setAdded('');
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={onKeyDown}
      />
      <ul id={listId} role="listbox" aria-label={t('releases.addStory')} className="story-picker__list" hidden={!expanded}>
        {shown.map((story, index) => (
          <li
            key={story.id}
            id={optionId(index)}
            role="option"
            aria-selected={index === current}
            className={`story-picker__option${index === current ? ' story-picker__option--active' : ''}`}
            // Keeps the focus in the field, so the click is not lost to the blur that closes the list.
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => pick(story)}
            onMouseMove={() => setActive(index)}
          >
            <span className="story-picker__code">{keyOf(story)}</span>
            <span className="story-picker__title">{story.title}</span>
          </li>
        ))}
        {matches.length > shown.length && (
          <li role="presentation" className="story-picker__more muted">
            {t('releases.picker.more', { count: matches.length - shown.length })}
          </li>
        )}
      </ul>
      {open && query.trim() !== '' && matches.length === 0 && (
        <p className="muted story-picker__none">{t('releases.picker.none', { query: query.trim() })}</p>
      )}
      <div role="status" className="sr-only">
        {added || (open && query.trim() !== '' ? t('releases.picker.results', { count: matches.length }) : '')}
      </div>
    </div>
  );
}
