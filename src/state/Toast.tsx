import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

/** A button in a notice, such as "Open story". */
export interface ToastAction {
  label: string;
  onClick: () => void;
}

interface ToastItem {
  id: number;
  message: string;
  action?: ToastAction;
}

interface ToastApi {
  /** Shows a short notice at the bottom of the window. It goes away by itself and is read out by screen readers. */
  notify(message: string, action?: ToastAction): void;
}

const ToastContext = createContext<ToastApi | null>(null);

/** How long a notice stays, in milliseconds; it stays while the pointer or the focus is on it. */
export const TOAST_MS = 5000;

const NOOP: ToastApi = { notify: () => undefined };

/** Notices for components inside the provider; outside it (in small tests) they do nothing. */
export function useToast(): ToastApi {
  return useContext(ToastContext) ?? NOOP;
}

function Toast({ item, onDone }: { item: ToastItem; onDone: (id: number) => void }) {
  const { t } = useTranslation();
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const start = useCallback(() => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => onDone(item.id), TOAST_MS);
  }, [item.id, onDone]);
  const stop = (): void => clearTimeout(timer.current);

  useEffect(() => {
    start();
    return stop;
  }, [start]);

  return (
    <div className="toast" onMouseEnter={stop} onMouseLeave={start} onFocus={stop} onBlur={start}>
      <span>{item.message}</span>
      {item.action && (
        <button
          type="button"
          className="toast__action"
          onClick={() => {
            item.action?.onClick();
            onDone(item.id);
          }}
        >
          {item.action.label}
        </button>
      )}
      <button type="button" className="toast__close" aria-label={t('toast.close')} title={t('toast.close')} onClick={() => onDone(item.id)}>
        ×
      </button>
    </div>
  );
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const next = useRef(1);
  const notify = useCallback((message: string, action?: ToastAction) => {
    const id = next.current++;
    // Only the newest notices stay; a series of actions does not pile up.
    setItems((current) => [...current.slice(-2), { id, message, action }]);
  }, []);
  const done = useCallback((id: number) => setItems((current) => current.filter((item) => item.id !== id)), []);
  const api = useMemo<ToastApi>(() => ({ notify }), [notify]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      {/* The live region is always there, so a screen reader announces every notice that appears in it. */}
      <div className="toasts" role="status" aria-live="polite">
        {items.map((item) => (
          <Toast key={item.id} item={item} onDone={done} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}
