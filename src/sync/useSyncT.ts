import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useApp } from '../state/AppState';
import { withService } from './syncT';

/** `useTranslation` for the texts of the sync: `{{service}}` is the name of the chosen service (#66). */
export function useSyncT() {
  const { t, i18n } = useTranslation();
  const service = useApp().settings.sync.service;
  return useMemo(() => ({ t: withService(t, service), i18n }), [t, i18n, service]);
}
