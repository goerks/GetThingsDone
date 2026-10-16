import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { versionsOf, type ChangeVersion } from '../../domain/changeLog';
import { useApp } from '../../state/AppState';
import { CompareDialog } from './CompareDialog';
import { HistoryList } from './HistoryList';
import { useHistoryText } from './historyText';

interface Props {
  itemType: string;
  itemId: string;
  /** The name of the item, for the title of the comparison. */
  label: string;
}

/**
 * The whole history of an item with a checkbox per version: tick two and compare them (#23). Used in the dialog "All
 * changes" and as the tab of a release.
 */
export function HistoryView({ itemType, itemId, label }: Props) {
  const { t } = useTranslation();
  const app = useApp();
  const text = useHistoryText();
  const versions = versionsOf(app.changeLog, itemType, itemId);
  // The ids of the ticked versions, the one ticked first at the start: a third tick replaces the oldest tick.
  const [selected, setSelected] = useState<string[]>([]);
  const [compare, setCompare] = useState<{ from: string; to: string } | null>(null);
  const latest = versions[versions.length - 1];

  const toggle = (version: ChangeVersion): void =>
    setSelected((current) => (current.includes(version.id) ? current.filter((id) => id !== version.id) : [...current.slice(-1), version.id]));
  const chosen = selected.map((id) => versions.find((version) => version.id === id)).filter((version): version is ChangeVersion => version !== undefined);
  const [older, newer] = [...chosen].sort((a, b) => a.version - b.version);

  return (
    <div className="history-view">
      {versions.length > 1 && (
        <div className="history-view__bar" role="status">
          <span>
            {chosen.length === 2 && latest
              ? t('history.chosenTwo', { first: text.versionName(older, latest.version), second: text.versionName(newer, latest.version) })
              : t('history.chooseTwo')}
          </span>
          <button type="button" className="btn btn--primary" disabled={chosen.length !== 2} onClick={() => older && newer && setCompare({ from: older.id, to: newer.id })}>
            {t('history.compare')}
          </button>
        </div>
      )}
      <HistoryList
        itemType={itemType}
        versions={versions}
        selected={versions.length > 1 ? selected : undefined}
        onToggle={versions.length > 1 ? toggle : undefined}
        onCompareWithCurrent={(version) => latest && setCompare({ from: version.id, to: latest.id })}
      />
      {compare && <CompareDialog itemType={itemType} versions={versions} label={label} fromId={compare.from} toId={compare.to} onClose={() => setCompare(null)} />}
    </div>
  );
}
