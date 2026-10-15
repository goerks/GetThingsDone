import { useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { averageVelocity, chartRows, velocityRows, type VelocityAverage, type VelocityRow } from '../domain/velocity';
import { useApp } from '../state/AppState';
import { niceMax } from './ScopeReport';
import { formatDayLong, formatSprintDates } from './sprintFormat';
import { useBuiltin } from './useBuiltin';

const W = 720;
const H = 260;
const LEFT = 40;
const RIGHT = 612;
const TOP = 28;
const BOTTOM = 220;

/** The average as short text for the head and the table: "Ø 21 points · last 3 sprints". */
function useAverageText(average: VelocityAverage | null) {
  const { t } = useTranslation();
  if (!average) return { head: '', line: '', foot: '' };
  const last = average.sprints === 3;
  return {
    head: last ? t('velocity.head.last', { points: average.points }) : t('velocity.head.few', { points: average.points, count: average.sprints }),
    line: last ? t('velocity.line.last', { points: average.points }) : t('velocity.line.few', { points: average.points, count: average.sprints }),
    foot: last ? t('velocity.foot.last', { points: average.points }) : t('velocity.foot.few', { points: average.points, count: average.sprints })
  };
}

function Details({ row, language }: { row: VelocityRow; language: string }) {
  const { t } = useTranslation();
  return (
    <>
      <strong>{row.name}</strong>
      <span>{formatSprintDates(row, language)}</span>
      <span>
        {t('velocity.tip.figures', { planned: row.planned, done: row.done })}
        {row.share !== null && ` (${row.share} %)`}
      </span>
      {row.addedStories > 0 && <span>{t('velocity.tip.added', { count: row.addedStories, stories: row.addedStories, points: row.addedPoints })}</span>}
    </>
  );
}

function Chart({ rows, average, line, label }: { rows: VelocityRow[]; average: VelocityAverage | null; line: string; label: string }) {
  const { i18n } = useTranslation();
  const language = i18n.resolvedLanguage ?? 'en';
  const [active, setActive] = useState<number | null>(null);
  const highest = Math.max(...rows.flatMap((row) => [row.planned, row.done]), average?.points ?? 0);
  const { max, step } = niceMax(highest);
  const y = (value: number): number => BOTTOM - (value / max) * (BOTTOM - TOP);
  const slot = (RIGHT - LEFT) / rows.length;
  const barWidth = Math.min(46, slot - 14);
  const yTicks = Array.from({ length: max / step + 1 }, (_, index) => index * step);
  const centre = (index: number): number => LEFT + slot * (index + 0.5);
  const shownRow = active !== null ? rows[active] : null;

  return (
    <div className="velocity__chart">
      <svg viewBox={`0 0 ${W} ${H}`} className="velocity-chart" role="group" aria-label={label}>
        {yTicks.map((tick) => (
          <g key={tick}>
            <line className="scope-chart__grid" x1={LEFT} x2={RIGHT} y1={y(tick)} y2={y(tick)} />
            <text x={LEFT - 8} y={y(tick) + 4} textAnchor="end">
              {tick}
            </text>
          </g>
        ))}
        <line className="scope-chart__axis" x1={LEFT} x2={RIGHT} y1={BOTTOM} y2={BOTTOM} />
        {average && (
          <g>
            <line className="velocity-chart__average" x1={LEFT} x2={RIGHT + 6} y1={y(average.points)} y2={y(average.points)} />
            <text className="velocity-chart__average-label" x={RIGHT + 10} y={y(average.points) + 4} textAnchor="start">
              {line}
            </text>
          </g>
        )}
        {rows.map((row, index) => (
          <g
            key={row.id}
            className={`velocity-chart__sprint${active === index ? ' velocity-chart__sprint--active' : ''}`}
            data-sprint-id={row.id}
            tabIndex={0}
            role="img"
            aria-label={`${row.name}: ${row.planned} / ${row.done}`}
            onMouseEnter={() => setActive(index)}
            onMouseLeave={() => setActive((current) => (current === index ? null : current))}
            onFocus={() => setActive(index)}
            onBlur={() => setActive((current) => (current === index ? null : current))}
          >
            <rect className="velocity-chart__hit" x={centre(index) - slot / 2} y={TOP - 14} width={slot} height={BOTTOM - TOP + 14 + 30} />
            <rect className="velocity-chart__plan-area" x={centre(index) - barWidth / 2} y={y(row.planned)} width={barWidth} height={BOTTOM - y(row.planned)} />
            <rect className="velocity-chart__done" x={centre(index) - barWidth / 2 + 3} y={y(row.done)} width={barWidth - 6} height={BOTTOM - y(row.done)} />
            <rect className="velocity-chart__planned" x={centre(index) - barWidth / 2} y={y(row.planned)} width={barWidth} height={BOTTOM - y(row.planned)} />
            <text
              className={`velocity-chart__value${row.done > row.planned ? ' velocity-chart__value--on' : ''}`}
              x={centre(index)}
              y={row.done > row.planned ? y(row.planned) + 14 : y(row.planned) - 5}
              textAnchor="middle"
            >
              {row.planned}
            </text>
            <text
              className={`velocity-chart__value${row.done <= row.planned && BOTTOM - y(row.done) >= 18 ? ' velocity-chart__value--on' : ''}`}
              x={centre(index)}
              y={row.done <= row.planned && BOTTOM - y(row.done) >= 18 ? y(row.done) + 14 : y(row.done) - 5}
              textAnchor="middle"
            >
              {row.done}
            </text>
            <text x={centre(index)} y={BOTTOM + 18} textAnchor="middle">
              {row.name}
            </text>
          </g>
        ))}
      </svg>
      {shownRow && (
        <div className="velocity__tip" role="tooltip" style={{ left: `${(centre(active as number) / W) * 100}%` }}>
          <Details row={shownRow} language={language} />
        </div>
      )}
    </div>
  );
}

/**
 * The velocity of the team (#24): a button in the head of the board that shows the average and opens a window under it
 * with the chart (planned and completed points of the last completed sprints as one combined bar each, the average of the last
 * three) and the table of all completed sprints. Esc, a click next to the window or the close button close it.
 */
export function VelocityButton() {
  const { t, i18n } = useTranslation();
  const app = useApp();
  const builtin = useBuiltin();
  const uid = useId();
  const language = i18n.resolvedLanguage ?? 'en';
  const [open, setOpen] = useState(false);
  const [pages, setPages] = useState(1);
  const root = useRef<HTMLSpanElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const [place, setPlace] = useState<CSSProperties>({});
  const all = velocityRows(app.sprints);
  const average = averageVelocity(all);
  const text = useAverageText(average);
  const shown = chartRows(all, pages);

  // The window is fixed under the button and as high as the free space in the browser window; it scrolls inside itself.
  useLayoutEffect(() => {
    if (!open) return;
    const place_ = (): void => {
      const box = button.current?.getBoundingClientRect();
      if (!box) return;
      const top = box.bottom + 8;
      setPlace({ top, right: Math.max(16, window.innerWidth - box.right), maxHeight: Math.max(160, window.innerHeight - top - 16) });
    };
    place_();
    window.addEventListener('resize', place_);
    window.addEventListener('scroll', place_, true);
    return () => {
      window.removeEventListener('resize', place_);
      window.removeEventListener('scroll', place_, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent): void => {
      if (event.key !== 'Escape') return;
      event.stopPropagation();
      setOpen(false);
      button.current?.focus();
    };
    const onPointer = (event: MouseEvent): void => {
      if (root.current && !root.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onPointer);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onPointer);
    };
  }, [open]);

  if (!builtin.shown('story', 'points')) return null;

  const label = t('velocity.chartLabel', { count: shown.rows.length });
  const panelId = `${uid}-panel`;

  return (
    <span className="velocity-menu" ref={root}>
      <button ref={button} type="button" className="btn velocity-button" aria-expanded={open} aria-controls={panelId} onClick={() => setOpen(!open)}>
        {average ? t('velocity.buttonAverage', { points: average.points }) : t('velocity.button')}
      </button>
      {open && (
        <section id={panelId} className="velocity" role="region" aria-label={t('velocity.title')} style={place}>
          <div className="velocity__head">
            <h2 className="velocity__title">{t('velocity.title')}</h2>
            {average && <span className="muted velocity__summary">{text.head}</span>}
            <button type="button" className="btn btn--small velocity__close" aria-label={t('velocity.close')} onClick={() => { setOpen(false); button.current?.focus(); }}>
              ✕
            </button>
          </div>
          {all.length === 0 ? (
            <div className="velocity__empty">
              <strong>{t('velocity.empty.title')}</strong>
              <p className="muted">{t('velocity.empty.text')}</p>
            </div>
          ) : (
            <div className="velocity__body">
              <div className="velocity__tools">
                <div className="scope__legend velocity__legend">
                  <span className="scope__key velocity__key--planned">{t('velocity.legend.planned')}</span>
                  <span className="scope__key velocity__key--done">{t('velocity.legend.done')}</span>
                  <span className="scope__key velocity__key--average">{t('velocity.legend.average')}</span>
                </div>
                {shown.hasOlder && (
                  <button type="button" className="btn" onClick={() => setPages(pages + 1)}>
                    ‹ {t('velocity.older')}
                  </button>
                )}
              </div>
              <Chart rows={shown.rows} average={average} line={text.line} label={label} />
              <div className="release-table-wrap" data-testid="velocity-table">
                <table className="release-table" aria-label={t('velocity.tableLabel')}>
                  <thead>
                    <tr>
                      <th scope="col">{t('velocity.table.sprint')}</th>
                      <th scope="col">{t('velocity.table.period')}</th>
                      <th scope="col">{t('velocity.table.completed')}</th>
                      <th scope="col">{t('velocity.table.planned')}</th>
                      <th scope="col">{t('velocity.table.added')}</th>
                      <th scope="col">{t('velocity.table.done')}</th>
                      <th scope="col">{t('velocity.table.share')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...all].reverse().map((row) => (
                      <tr key={row.id}>
                        <th scope="row">{row.name}</th>
                        <td>{formatSprintDates(row, language)}</td>
                        <td>{formatDayLong(row.completedOn, language)}</td>
                        <td>{row.planned}</td>
                        <td>{row.addedPoints > 0 ? `+${row.addedPoints}` : '–'}</td>
                        <td>{row.done}</td>
                        <td>{row.share === null ? '–' : `${row.share} %`}</td>
                      </tr>
                    ))}
                  </tbody>
                  {average && (
                    <tfoot>
                      <tr>
                        <th scope="row" colSpan={7}>
                          {text.foot}
                        </th>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
              <p className="muted velocity__explain">{t('velocity.explain')}</p>
            </div>
          )}
        </section>
      )}
    </span>
  );
}
