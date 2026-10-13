import type { CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { statusColor } from '../domain/statuses';
import { useApp } from '../state/AppState';
import { statusLabel } from './statusLabel';

/** A status as a dot in the shade of its category plus its name, so colour is never the only signal. */
export function StatusDot({ status }: { status: string }) {
  const { t } = useTranslation();
  const app = useApp();
  return (
    <span className="status-dot" data-status={status} style={{ '--status-color': statusColor(app.statuses, status) } as CSSProperties}>
      {statusLabel(t, app.statuses, status)}
    </span>
  );
}
