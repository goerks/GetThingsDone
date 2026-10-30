import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { serviceName } from '../sync/syncT';
import { useApp } from '../state/AppState';

/**
 * The reason why an element is disabled while the connected service decides it (#66): "Managed by Jira". The wrapper carries
 * the tooltip, because a disabled button shows none of its own in every browser. Without a reason it shows the element as it is.
 */
export function Managed({ by, children }: { by: string | null; children: ReactNode }) {
  return by ? (
    <span className="managed" title={by}>
      {children}
    </span>
  ) : (
    <>{children}</>
  );
}

/** The reason text for the service that is chosen now. */
export function useManagedText(): string {
  const { t } = useTranslation();
  const app = useApp();
  return t('sync.managedBy', { service: serviceName(t, app.settings.sync.service) });
}
