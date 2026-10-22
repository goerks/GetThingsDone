import { Fragment, useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { compareStates, isList, type ChangeVersion, type CompareRow, type ListEntry, type StateValue } from '../../domain/changeLog';
import { diffText } from '../../domain/textDiff';
import { Dialog } from '../Dialog';
import { useHistoryText, type HistoryText } from './historyText';
import { Button, Select } from '../../ui';

interface Props {
  itemType: string;
  /** The versions of one item, oldest first. */
  versions: readonly ChangeVersion[];
  /** The name of the item, for the title. */
  label: string;
  /** The version on the left and on the right when the dialog opens; the last two versions by default. */
  fromId?: string;
  toId?: string;
  onClose: () => void;
}

/** Two versions of an item side by side: changed fields with the old value on the left and the new one on the right (#23). */
export function CompareDialog({ itemType, versions, label, fromId, toId, onClose }: Props) {
  const { t } = useTranslation();
  const text = useHistoryText();
  const uid = useId();
  const latest = versions[versions.length - 1];
  const [from, setFrom] = useState(fromId ?? versions[Math.max(versions.length - 2, 0)]?.id);
  const [to, setTo] = useState(toId ?? latest?.id);
  const [onlyChanges, setOnlyChanges] = useState(true);
  const left = versions.find((version) => version.id === from);
  const right = versions.find((version) => version.id === to);
  if (!left || !right || !latest) {
    return (
      <Dialog title={t('history.compareTitle')} onClose={onClose}>
        <p>{t('history.empty')}</p>
      </Dialog>
    );
  }
  const rows = compareStates(left.state, right.state);
  const changed = rows.filter((row) => !row.same);
  const same = rows.filter((row) => row.same);
  const shown = onlyChanges ? changed : rows;
  const rowId = (key: string): string => `${uid}-row-${key.replace(/[^a-z0-9]/gi, '-')}`;
  const nameOf = (version: ChangeVersion): string => text.versionName(version, latest.version);
  const optionText = (version: ChangeVersion): string => `${nameOf(version)} · ${text.time(version.at)}`;
  const jump = (key: string): void => {
    setOnlyChanges(true);
    const element = document.getElementById(rowId(key));
    element?.scrollIntoView?.({ block: 'nearest' });
    element?.focus();
  };

  return (
    <Dialog title={t('history.compareHeading', { name: label })} wide onClose={onClose}>
      <div className="compare">
        <div className="compare__bar">
          <Button type="button" size="small" onClick={onClose}>
            {t('history.back')}
          </Button>
          <div className="field compare__pick">
            <label htmlFor={`${uid}-from`}>{t('history.from')}</label>
            <Select id={`${uid}-from`} value={left.id} onChange={(event) => setFrom(event.target.value)}>
              {[...versions].reverse().map((version) => (
                <option key={version.id} value={version.id}>
                  {optionText(version)}
                </option>
              ))}
            </Select>
          </div>
          <Button
            type="button"
            size="small"
            onClick={() => {
              setFrom(right.id);
              setTo(left.id);
            }}
            aria-label={t('history.swap')}
            title={t('history.swap')}
          >
            ⇄
          </Button>
          <div className="field compare__pick">
            <label htmlFor={`${uid}-to`}>{t('history.to')}</label>
            <Select id={`${uid}-to`} value={right.id} onChange={(event) => setTo(event.target.value)}>
              {[...versions].reverse().map((version) => (
                <option key={version.id} value={version.id}>
                  {optionText(version)}
                </option>
              ))}
            </Select>
          </div>
          <label className="compare__only">
            <input type="checkbox" checked={onlyChanges} onChange={(event) => setOnlyChanges(event.target.checked)} />
            {t('history.onlyChanges')}
          </label>
        </div>

        <div role="status" className="compare__summary">
          {changed.length === 0 ? (
            <strong>{t('history.noDifferences')}</strong>
          ) : (
            <>
              <span>{t('history.changedFields', { changed: changed.length, total: rows.length })}</span>
              <span className="compare__chips">
                {changed.map((row) => (
                  <button key={row.key} type="button" className="compare__chip" onClick={() => jump(row.key)}>
                    {text.label(itemType, row.key)}
                  </button>
                ))}
              </span>
            </>
          )}
        </div>

        {changed.length > 0 || !onlyChanges ? (
          <table className="compare__table">
            <thead>
              <tr>
                <th scope="col">{t('history.field')}</th>
                <th scope="col">
                  <VersionHead version={left} text={text} latest={latest.version} />
                </th>
                <th scope="col">
                  <VersionHead version={right} text={text} latest={latest.version} />
                </th>
              </tr>
            </thead>
            <tbody>
              {shown.map((row) => (
                <CompareRowView key={row.key} row={row} itemType={itemType} text={text} id={rowId(row.key)} leftName={nameOf(left)} rightName={nameOf(right)} />
              ))}
            </tbody>
          </table>
        ) : null}
        {onlyChanges && same.length > 0 && changed.length > 0 && (
          <p className="muted compare__fold">{t('history.hidden', { count: same.length, names: same.map((row) => text.label(itemType, row.key)).join(', ') })}</p>
        )}
      </div>
    </Dialog>
  );
}

function VersionHead({ version, text, latest }: { version: ChangeVersion; text: HistoryText; latest: number }) {
  return (
    <span className="compare__version">
      <strong>{text.versionName(version, latest)}</strong>
      <span className="muted">{text.time(version.at)}</span>
    </span>
  );
}

interface RowProps {
  row: CompareRow;
  itemType: string;
  text: HistoryText;
  id: string;
  leftName: string;
  rightName: string;
}

function CompareRowView({ row, itemType, text, id, leftName, rightName }: RowProps) {
  const { t } = useTranslation();
  const name = text.label(itemType, row.key);
  const head = (
    <th scope="row" id={id} tabIndex={-1} className="compare__field">
      {!row.same && (
        <>
          <span aria-hidden="true" className="compare__sign">
            ~
          </span>
          <span className="sr-only">{t('history.rowChanged')} </span>
        </>
      )}
      {name}
    </th>
  );
  // Long texts take the whole width, so the lines can sit side by side.
  if (!row.same && text.isLong(row.key)) {
    return (
      <tr className="compare__row compare__row--changed">
        {head}
        <td colSpan={2}>
          <TextDiff before={asText(row.before)} after={asText(row.after)} leftName={leftName} rightName={rightName} />
        </td>
      </tr>
    );
  }
  if (isList(row.before) || isList(row.after) || row.list) {
    return (
      <tr className={`compare__row${row.same ? '' : ' compare__row--changed'}`}>
        {head}
        <td data-label={leftName}>
          <EntryList row={row} side="left" text={text} />
        </td>
        <td data-label={rightName}>
          <EntryList row={row} side="right" text={text} />
        </td>
      </tr>
    );
  }
  const shown = (value: StateValue | undefined): string => (text.isLong(row.key) ? asText(value) : text.value(itemType, row.key, value));
  return (
    <tr className={`compare__row${row.same ? '' : ' compare__row--changed'}`}>
      {head}
      <td data-label={leftName}>{row.same ? <span>{shown(row.before)}</span> : <Mark kind="del" text={shown(row.before)} />}</td>
      <td data-label={rightName}>{row.same ? <span>{shown(row.after)}</span> : <Mark kind="ins" text={shown(row.after)} />}</td>
    </tr>
  );
}

const asText = (value: StateValue | undefined): string => (typeof value === 'string' ? value : '');

/** A removed or added value: the sign and the hidden word say it besides the colour. */
function Mark({ kind, text }: { kind: 'del' | 'ins'; text: string }) {
  const { t } = useTranslation();
  return (
    <span className={`diff diff--${kind}`}>
      <span aria-hidden="true" className="diff__sign">
        {kind === 'del' ? '−' : '+'}
      </span>
      <span className="sr-only">{t(kind === 'del' ? 'history.removed' : 'history.added')} </span>
      {text}
    </span>
  );
}

function EntryList({ row, side, text }: { row: CompareRow; side: 'left' | 'right'; text: HistoryText }) {
  const { t } = useTranslation();
  const entries: ListEntry[] = (isList(side === 'left' ? row.before : row.after) ? (side === 'left' ? row.before : row.after) : []) as ListEntry[];
  const list = row.list;
  if (entries.length === 0) return <span className="muted">{t('history.none')}</span>;
  const marked = (entry: ListEntry): 'del' | 'ins' | 'chg' | null => {
    if (!list) return null;
    if (side === 'left') return list.removed.some((item) => item.id === entry.id) ? 'del' : list.edited.some((item) => item.before.id === entry.id) ? 'chg' : null;
    return list.added.some((item) => item.id === entry.id) ? 'ins' : list.edited.some((item) => item.after.id === entry.id) ? 'chg' : null;
  };
  return (
    <ul className="compare__entries">
      {entries.map((entry) => {
        const kind = marked(entry);
        const ticked = list?.ticked.some((item) => item.id === entry.id) ?? false;
        const unticked = list?.unticked.some((item) => item.id === entry.id) ?? false;
        return (
          <li key={entry.id}>
            {kind === 'del' && <Fragment><span aria-hidden="true" className="diff__sign diff--del">−</span><span className="sr-only">{t('history.removed')} </span></Fragment>}
            {kind === 'ins' && <Fragment><span aria-hidden="true" className="diff__sign diff--ins">+</span><span className="sr-only">{t('history.added')} </span></Fragment>}
            {kind === 'chg' && <Fragment><span aria-hidden="true" className="diff__sign">~</span><span className="sr-only">{t('history.rowChanged')} </span></Fragment>}
            {entry.done !== undefined && (
              <span aria-hidden="true" className="compare__box">
                {entry.done ? '☑' : '☐'}
              </span>
            )}
            {entry.done !== undefined && <span className="sr-only">{t(entry.done ? 'history.checked' : 'history.unchecked')} </span>}
            <span className={kind === 'del' ? 'diff diff--del' : kind === 'ins' || kind === 'chg' ? 'diff diff--ins' : undefined}>{text.entryName(row.key, entry)}</span>
            {side === 'right' && ticked && <span className="history-tag">{t('history.ticked')}</span>}
            {side === 'right' && unticked && <span className="history-tag">{t('history.unticked')}</span>}
          </li>
        );
      })}
    </ul>
  );
}

/** Line by line, with line numbers and the changed words marked. */
function TextDiff({ before, after, leftName, rightName }: { before: string; after: string; leftName: string; rightName: string }) {
  const { t } = useTranslation();
  const rows = diffText(before, after);
  const change = rows.filter((row) => row.kind === 'change').length;
  return (
    <div className="textdiff" role="group" aria-label={t('history.textDiff', { count: change })}>
      <div className="textdiff__head" aria-hidden="true">
        <span>{leftName}</span>
        <span>{rightName}</span>
      </div>
      {rows.map((row, index) => (
        <div key={index} className={`textdiff__row${row.kind === 'change' ? ' textdiff__row--change' : ''}`}>
          <Line side="left" line={row.left} changed={row.kind === 'change'} />
          <Line side="right" line={row.right} changed={row.kind === 'change'} />
        </div>
      ))}
    </div>
  );
}

function Line({ side, line, changed }: { side: 'left' | 'right'; line: { no: number; pieces: Array<{ text: string; mark: boolean }> } | null; changed: boolean }) {
  const { t } = useTranslation();
  if (!line) return <div className="textdiff__line textdiff__line--empty" aria-hidden="true" />;
  const kind = changed ? (side === 'left' ? 'del' : 'ins') : 'same';
  return (
    <div className={`textdiff__line textdiff__line--${kind}`}>
      <span className="textdiff__no" aria-hidden="true">
        {line.no}
      </span>
      <span className="textdiff__sign" aria-hidden="true">
        {kind === 'del' ? '−' : kind === 'ins' ? '+' : ''}
      </span>
      {kind !== 'same' && <span className="sr-only">{t(kind === 'del' ? 'history.removed' : 'history.added')} </span>}
      <span className="textdiff__text">
        {line.pieces.map((piece, index) => (piece.mark ? <mark key={index}>{piece.text}</mark> : <Fragment key={index}>{piece.text}</Fragment>))}
      </span>
    </div>
  );
}
