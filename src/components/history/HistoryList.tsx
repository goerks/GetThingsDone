import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import type { ChangeVersion } from '../../domain/changeLog';
import { useHistoryText } from './historyText';

interface Props {
  itemType: string;
  /** The versions of one item, oldest first. */
  versions: readonly ChangeVersion[];
  /** Only the newest entries. */
  limit?: number;
  /** Shows a checkbox per version; `selected` holds the chosen version ids, the oldest choice first. */
  selected?: readonly string[];
  onToggle?: (version: ChangeVersion) => void;
  /** Compares the version with the current one. */
  onCompareWithCurrent: (version: ChangeVersion) => void;
}

/** The versions of an item, newest first, each with what it changed (#23). */
export function HistoryList({ itemType, versions, limit, selected, onToggle, onCompareWithCurrent }: Props) {
  const { t } = useTranslation();
  const text = useHistoryText();
  const uid = useId();
  const latest = versions.length > 0 ? versions[versions.length - 1].version : 0;
  const shown = [...versions].reverse().slice(0, limit);
  // A history that only holds its first version, made when the history began, has nothing to show yet.
  if (versions.length === 0 || (versions.length === 1 && versions[0].origin === 'baseline')) {
    return (
      <p className="muted" data-testid="history-empty">
        {t('history.empty')}
      </p>
    );
  }
  return (
    <ol className="history-list" aria-label={t('history.listLabel')}>
      {shown.map((version) => {
        const index = versions.indexOf(version);
        const lines = text.summary(itemType, version, index > 0 ? versions[index - 1] : null);
        const name = text.versionName(version, latest);
        const isLatest = version.version === latest;
        return (
          <li key={version.id} className={`history-entry${selected?.includes(version.id) ? ' history-entry--selected' : ''}`}>
            <div className="history-entry__head">
              {onToggle && (
                <input
                  id={`${uid}-${version.id}`}
                  type="checkbox"
                  className="history-entry__check"
                  checked={selected?.includes(version.id) ?? false}
                  onChange={() => onToggle(version)}
                  aria-label={t('history.choose', { version: name })}
                />
              )}
              <span className="history-entry__version">{t('history.version', { number: version.version })}</span>
              <time className="history-entry__time muted" dateTime={version.at}>
                {text.time(version.at)}
              </time>
              {isLatest ? (
                <span className="history-tag history-entry__current">{t('history.current')}</span>
              ) : (
                <button type="button" className="link-btn history-entry__compare" onClick={() => onCompareWithCurrent(version)} aria-label={t('history.compareWithCurrentOf', { version: name })}>
                  {t('history.compareWithCurrent')}
                </button>
              )}
            </div>
            <ul className="history-entry__lines">
              {lines.map((line, number) => (
                <li key={number}>{line}</li>
              ))}
            </ul>
          </li>
        );
      })}
    </ol>
  );
}
