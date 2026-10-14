import { modKey } from './platform';

interface Props {
  label: string;
  onClick: () => void;
}

/** The primary "New …" button in the page head of every page, with the shortcut written on it (#32, U4). */
export function NewButton({ label, onClick }: Props) {
  return (
    <button type="button" className="btn btn--primary page-head__action new-button" aria-keyshortcuts="Control+N Meta+N" onClick={onClick}>
      {label}
      <kbd className="new-button__keys" aria-hidden="true">
        {modKey()}+N
      </kbd>
    </button>
  );
}
