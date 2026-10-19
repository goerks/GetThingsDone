import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';

/**
 * A small "i" that holds an explanation, so the screen stays tidy. The text is the tooltip on hover; a click or Enter
 * opens it below the heading, and a second one closes it. The text is always in the page, so screen readers can read it.
 */
export function InfoHint({ text, label, id: given }: { text: string; label?: string; id?: string }) {
  const { t } = useTranslation();
  const own = useId();
  const id = given ?? own;
  const [open, setOpen] = useState(false);
  return (
    <span className="info-hint">
      <button type="button" className="info-hint__button" aria-label={label ?? t('info.label')} aria-expanded={open} aria-controls={id} title={text} onClick={() => setOpen(!open)}>
        <span aria-hidden="true">i</span>
      </button>
      <span id={id} role="note" className="info-hint__text" hidden={!open}>
        {text}
      </span>
    </span>
  );
}
