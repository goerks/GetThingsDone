import { Button } from '../ui';

interface Props {
  label: string;
  onClick: () => void;
}

/** The primary "New …" button in the page head of every page. Ctrl+N works, but is not written on it (#55). */
export function NewButton({ label, onClick }: Props) {
  return (
    <Button type="button" variant="primary" className="page-head__action new-button" aria-keyshortcuts="Control+N Meta+N" onClick={onClick}>
      {label}
    </Button>
  );
}
