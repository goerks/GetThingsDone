import { useContext, useEffect, useId, useRef, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { DetailNavContext, type DetailNav } from '../state/detailNav';

interface Props {
  /** Visible heading. Without it, `label` names the dialog for assistive technology. */
  title?: string;
  label?: string;
  /** Wider dialog for detail views. */
  wide?: boolean;
  onClose: () => void;
  children: ReactNode;
}

/**
 * Modal dialog on the native <dialog> element: focus stays inside, Escape closes it,
 * and focus returns to the element that opened it.
 */
export function Dialog({ title, label, wide = false, onClose, children }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const nav = useContext(DetailNavContext);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    const opener = document.activeElement as HTMLElement | null;
    // jsdom has no showModal; the open attribute keeps the dialog usable there.
    if (typeof dialog.showModal === 'function') dialog.showModal();
    else dialog.setAttribute('open', '');
    return () => {
      if (dialog.open && typeof dialog.close === 'function') dialog.close();
      opener?.focus?.();
    };
  }, []);

  return (
    <dialog
      ref={ref}
      className={`dialog${wide ? ' dialog--wide' : ''}`}
      aria-labelledby={title ? titleId : undefined}
      aria-label={title ? undefined : label}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onMouseDown={(event) => {
        // A click on the backdrop (the dialog element itself, outside its content) closes it.
        if (event.target === event.currentTarget) onClose();
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
