import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { versionsOf } from '../../domain/changeLog';
import { useApp } from '../../state/AppState';
import { Dialog } from '../Dialog';
import { CompareDialog } from './CompareDialog';
import { HistoryList } from './HistoryList';
import { HistoryView } from './HistoryView';

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
  const [compare, setCompare] = useState<{ from?: string; to?: string } | null>(null);
  const latest = versions[versions.length - 1];
  const changes = versions.filter((version) => version.origin === 'changed').length;
  const recent = versions.slice(-3);

  return (
    <section className="panel history-panel" aria-labelledby={`${uid}-title`}>
      <div className="panel__head">
        <h2 id={`${uid}-title`}>{t('history.title')}</h2>
        <span className="muted">{t('history.count', { count: versions.length })}</span>
        <button type="button" className="btn btn--small history-panel__compare" disabled={versions.length < 2} onClick={() => setCompare({})}>
          {t('history.compareButton')}
        </button>
      </div>
      <HistoryList
        itemType={itemType}
        versions={versions}
        limit={3}
        onCompareWithCurrent={(version) => latest && setCompare({ from: version.id, to: latest.id })}
      />
      {versions.length > recent.length && (
        <button type="button" className="link-btn history-panel__all" onClick={() => setAll(true)}>
          {t('history.showAll', { count: changes })}
        </button>
      )}
      {all && (
        <Dialog title={t('history.allTitle', { name: label })} wide onClose={() => setAll(false)}>
          <HistoryView itemType={itemType} itemId={itemId} label={label} />
          <div className="form__actions">
            <button type="button" className="btn" onClick={() => setAll(false)}>
              {t('detail.close')}
            </button>
          </div>
        </Dialog>
      )}
      {compare && <CompareDialog itemType={itemType} versions={versions} label={label} fromId={compare.from} toId={compare.to} onClose={() => setCompare(null)} />}
    </section>
  );
}
