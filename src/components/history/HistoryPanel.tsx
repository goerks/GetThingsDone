import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { versionsOf } from '../../domain/changeLog';
import { useApp } from '../../state/AppState';
import { Dialog } from '../Dialog';
import { CompareDialog } from './CompareDialog';
import { HistoryList } from './HistoryList';
import { HistoryView } from './HistoryView';
import { Button } from '../../ui';

interface Props {
  /** `story`, `epic`, `sprint`, `release`, later a custom item type. */
  itemType: string;
  itemId: string;
  /** The name of the item, for the titles of the dialogs. */
  label: string;
}

/** The newest changes of an item in its dialog, with the way to all changes and to the comparison of two versions (#23). */
export function HistoryPanel({ itemType, itemId, label }: Props) {
  const { t } = useTranslation();
  const app = useApp();
  const uid = useId();
  const versions = versionsOf(app.changeLog, itemType, itemId);
  const [all, setAll] = useState(false);
  // Collapsed, the panel shows only the current version; opened, it shows the last three.
  const [open, setOpen] = useState(false);
  const [compare, setCompare] = useState<{ from?: string; to?: string } | null>(null);
  const latest = versions[versions.length - 1];
  const changes = versions.filter((version) => version.origin === 'changed').length;
  const recent = versions.slice(-3);

  return (
    <section className="panel history-panel" aria-labelledby={`${uid}-title`}>
      <div className="panel__head">
        <h2 id={`${uid}-title`}>{t('history.title')}</h2>
        <span className="muted">{t('history.count', { count: versions.length })}</span>
        <Button type="button" size="small" className="history-panel__compare" disabled={versions.length < 2} onClick={() => setCompare({})}>
          {t('history.compareButton')}
        </Button>
      </div>
      <div id={`${uid}-list`}>
        <HistoryList
          itemType={itemType}
          versions={versions}
          limit={open ? 3 : 1}
          onCompareWithCurrent={(version) => latest && setCompare({ from: version.id, to: latest.id })}
        />
      </div>
      {versions.length > 1 && (
        <div className="history-panel__more">
          <button type="button" className="link-btn" aria-expanded={open} aria-controls={`${uid}-list`} onClick={() => setOpen((current) => !current)}>
            {t(open ? 'history.collapse' : 'history.expand')}
          </button>
          {open && versions.length > recent.length && (
            <button type="button" className="link-btn history-panel__all" onClick={() => setAll(true)}>
              {t('history.showAll', { count: changes })}
            </button>
          )}
        </div>
      )}
      {all && (
        <Dialog title={t('history.allTitle', { name: label })} wide onClose={() => setAll(false)}>
          <HistoryView itemType={itemType} itemId={itemId} label={label} />
          <div className="form__actions">
            <Button type="button" onClick={() => setAll(false)}>
              {t('detail.close')}
            </Button>
          </div>
        </Dialog>
      )}
      {compare && <CompareDialog itemType={itemType} versions={versions} label={label} fromId={compare.from} toId={compare.to} onClose={() => setCompare(null)} />}
    </section>
  );
}
