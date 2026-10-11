import { useEffect, useId, useRef, type ReactNode } from 'react';

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
        {title && (
          <h2 id={titleId} className="dialog__title">
            {title}
          </h2>
        )}
        {children}
      </div>
    </dialog>
  );
}
