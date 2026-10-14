import { useContext, useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { DetailNavContext, type DetailNav } from '../state/detailNav';

interface Props {
  /** Visible heading. Without it, `label` names the dialog for assistive technology. */
  title?: string;
  label?: string;
  /** Wider dialog for detail views. */
  wide?: boolean;
  /**
   * The dialog holds input that would be lost. Escape or a click beside the dialog then ask "Discard input?"
   * instead of closing it. Buttons that close on purpose (Cancel) still close at once.
   */
  dirty?: boolean;
  /** Ctrl+Enter submits the form of the dialog from any field (create dialogs). */
  submitShortcut?: boolean;
  onClose: () => void;
  children: ReactNode;
}

/**
 * Modal dialog on the native <dialog> element: focus stays inside, Escape closes it,
 * and focus returns to the element that opened it.
 */
export function Dialog({ title, label, wide = false, dirty = false, submitShortcut = false, onClose, children }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const openedAt = useRef(0);
  const returnTo = useRef<HTMLElement | null>(null);
  const [asking, setAsking] = useState(false);
  const nav = useContext(DetailNavContext);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    const opener = document.activeElement as HTMLElement | null;
    openedAt.current = performance.now();
    // jsdom has no showModal; the open attribute keeps the dialog usable there.
    if (typeof dialog.showModal === 'function') dialog.showModal();
    else dialog.setAttribute('open', '');
    // Keys such as Escape and the arrows must reach the dialog: make sure focus is inside, as browsers do on showModal.
    if (!dialog.contains(document.activeElement))
      dialog
        .querySelector<HTMLElement>('button:not(:disabled), [href], input:not(:disabled), select:not(:disabled), textarea, [tabindex]:not([tabindex="-1"])')
        ?.focus();
    return () => {
      if (dialog.open && typeof dialog.close === 'function') dialog.close();
      opener?.focus?.();
    };
  }, []);

  /** Closes the dialog, or asks first when it holds input. */
  const requestClose = (): void => {
    if (!dirty) {
      onClose();
      return;
    }
    returnTo.current = document.activeElement as HTMLElement | null;
    setAsking(true);
  };
  const keepEditing = (): void => {
    setAsking(false);
    returnTo.current?.focus?.();
  };

  return (
    <dialog
      ref={ref}
      className={`dialog${wide ? ' dialog--wide' : ''}`}
      aria-labelledby={title ? titleId : undefined}
      aria-label={title ? undefined : label}
      onCancel={(event) => {
        event.preventDefault();
        requestClose();
      }}
      onKeyDown={(event) => {
        if (event.defaultPrevented) return;
        if (event.key === 'Escape') {
          // Close here, so Escape works the same in every browser (and nested editors can keep it by preventing it).
          event.preventDefault();
          requestClose();
          return;
        }
        if (submitShortcut && event.key === 'Enter' && (event.ctrlKey || event.metaKey) && !event.shiftKey && !event.altKey) {
          event.preventDefault();
          ref.current?.querySelector('form')?.requestSubmit();
          return;
        }
        // Left and right step through the list of the navigation bar, unless a field needs the arrow keys.
        if (!nav || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
        if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
        const target = event.target as HTMLElement;
        if (target.closest('input, textarea, select, [contenteditable="true"], [role="slider"]')) return;
        const step = event.key === 'ArrowLeft' ? nav.previous : nav.next;
        if (step) {
          event.preventDefault();
          step();
        }
      }}
      onMouseDown={(event) => {
        // A click on the backdrop (the dialog element itself, outside its content) closes it. Within a moment of
        // opening it is ignored, so the second click of a double click on a card does not close what the first opened.
        if (event.target === event.currentTarget && performance.now() - openedAt.current > 400) requestClose();
      }}
    >
      <div className="dialog__body">
        {nav && <NavBar nav={nav} />}
        {title && (
          <h2 id={titleId} className="dialog__title">
            {title}
          </h2>
        )}
        {/* Dialogs opened from inside this one do not repeat the bar. */}
        <DetailNavContext.Provider value={null}>{children}</DetailNavContext.Provider>
        {asking && <DiscardAsk onKeepEditing={keepEditing} onDiscard={onClose} />}
      </div>
    </dialog>
  );
}

/** "Result 2 of 7" with previous, next and back, for stepping through a list without closing the dialog. */
function NavBar({ nav }: { nav: DetailNav }) {
  const { t } = useTranslation();
  return (
    <nav className="detail-nav" aria-label={t('search.nav.label')}>
      <span className="detail-nav__query">{nav.label}</span>
      <span className="detail-nav__position">{t('search.nav.position', { position: nav.position, total: nav.total })}</span>
      <span className="detail-nav__buttons">
        <button
          type="button"
          className="btn btn--small"
          onClick={() => nav.previous?.()}
          disabled={!nav.previous}
          aria-label={t('search.nav.previous')}
          title={t('search.nav.previous')}
        >
          ‹
        </button>
        <button
          type="button"
          className="btn btn--small"
          onClick={() => nav.next?.()}
          disabled={!nav.next}
          aria-label={t('search.nav.next')}
          title={t('search.nav.next')}
        >
          ›
        </button>
        <button type="button" className="btn btn--small" onClick={nav.back}>
          {t('search.nav.back')}
        </button>
      </span>
    </nav>
  );
}

/** "Discard input?" in the dialog, with the focus on the safe answer. */
function DiscardAsk({ onKeepEditing, onDiscard }: { onKeepEditing: () => void; onDiscard: () => void }) {
  const { t } = useTranslation();
  const id = useId();
  const keep = useRef<HTMLButtonElement>(null);
  // After a click beside the dialog the browser still moves the focus to the dialog; take it back a moment later.
  useEffect(() => {
    keep.current?.focus();
    const timer = setTimeout(() => keep.current?.focus(), 0);
    return () => clearTimeout(timer);
  }, []);
  return (
    <div role="alertdialog" aria-labelledby={id} className="discard-ask" onKeyDown={(event) => {
        // Escape answers the question with "keep editing".
        if (event.key !== 'Escape') return;
        event.preventDefault();
        event.stopPropagation();
        onKeepEditing();
      }}
    >
      <p id={id} className="discard-ask__text">
        {t('dialog.discardTitle')}
      </p>
      <button type="button" className="btn" onClick={onKeepEditing} ref={keep}>
        {t('dialog.keepEditing')}
      </button>
      <button type="button" className="btn btn--danger" onClick={onDiscard}>
        {t('dialog.discard')}
      </button>
    </div>
  );
}
