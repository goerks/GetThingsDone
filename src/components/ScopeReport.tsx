import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { scopeReport, type Amount, type ScopeReport as Report } from '../domain/history';
import { todayIso } from '../domain/sprints';
import type { Release } from '../domain/types';
import { useApp } from '../state/AppState';
import { formatDay } from './releaseFormat';
import { useBuiltin } from './useBuiltin';
import { useReportUnit, type ReportUnit } from './useReportUnit';

const W = 680;
const H = 284;
const LEFT = 48;
const RIGHT = 660;
const TOP = 16;
const BOTTOM = 250;

/** A y axis that ends on a round number above the largest value. */
export function niceMax(value: number): { max: number; step: number } {
  const raw = Math.max(value, 1);
  const step = [1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000].find((candidate) => raw / candidate <= 5) ?? 1000;
  return { max: Math.ceil(raw / step) * step, step };
}

const amountOf = (amount: Amount, unit: ReportUnit): number => (unit === 'points' ? amount.points : amount.tickets);
const signed = (value: number): string => (value > 0 ? `+${value}` : value < 0 ? `−${Math.abs(value)}` : '±0');

function Chart({ report, unit, label }: { report: Report; unit: ReportUnit; label: string }) {
  const { i18n } = useTranslation();
  const language = i18n.resolvedLanguage ?? 'en';
  const days = report.days;
  const scope = days.map((day) => amountOf(day.scope, unit));
  const done = days.map((day) => amountOf(day.done, unit));
  const { max, step } = niceMax(Math.max(...scope));
  const x = (index: number): number => LEFT + (index / (days.length - 1)) * (RIGHT - LEFT);
  const y = (value: number): number => BOTTOM - (value / max) * (BOTTOM - TOP);
  const stepPath = (values: number[]): string =>
    `M${x(0)},${y(values[0])}` + values.slice(1).map((value, index) => ` H${x(index + 1)} V${y(value)}`).join('');
  const yTicks = Array.from({ length: max / step + 1 }, (_, index) => index * step);
  const tickCount = Math.min(5, days.length);
  const xTicks = Array.from({ length: tickCount }, (_, index) => Math.round((index / (tickCount - 1)) * (days.length - 1)));
  const short = (day: string): string => {
    const [year, month, date] = day.split('-').map(Number);
    return new Intl.DateTimeFormat(language, { day: 'numeric', month: 'short' }).format(new Date(year, month - 1, date));
  };

  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label} className="scope-chart">
      {yTicks.map((tick) => (
        <g key={tick}>
          <line className="scope-chart__grid" x1={LEFT} x2={RIGHT} y1={y(tick)} y2={y(tick)} />
          <text x={LEFT - 8} y={y(tick) + 4} textAnchor="end">
            {tick}
          </text>
        </g>
      ))}
      <line className="scope-chart__axis" x1={LEFT} x2={RIGHT} y1={BOTTOM} y2={BOTTOM} />
      {xTicks.map((index) => (
        <text key={index} x={x(index)} y={BOTTOM + 20} textAnchor={index === 0 ? 'start' : index === days.length - 1 ? 'end' : 'middle'}>
          {short(days[index].day)}
        </text>
      ))}
      <path className="scope-chart__done" d={stepPath(done)} />
      <path className="scope-chart__scope" d={stepPath(scope)} />
      {days.map((day, index) => {
        const change = amountOf(day.change, unit);
        if (change === 0) return null;
        return (
          <g key={day.day}>
            <circle className={change > 0 ? 'scope-chart__up' : 'scope-chart__down'} cx={x(index)} cy={y(scope[index])} r={4.5} />
            <text className="scope-chart__tag" x={x(index)} y={y(scope[index]) + (change > 0 ? -10 : 18)} textAnchor="middle">
              {signed(change)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

/** What a change of the scope looks like in the list: added or removed with the amount, or the points before and after. */
function ChangeText({ change, unit }: { change: Report['changes'][number]; unit: ReportUnit }) {
  const { t } = useTranslation();
  if (change.kind === 'points') {
    return <span className={`delta ${change.points > 0 ? 'delta--up' : 'delta--down'}`}>{t('releases.scope.change.points', { from: change.pointsFrom, to: change.pointsTo, diff: signed(change.points) })}</span>;
  }
  const amount = unit === 'points' ? `${signed(change.points)} ${t('releases.scope.unitShort.points')}` : signed(change.tickets);
  return <span className={`delta ${change.tickets > 0 ? 'delta--up' : 'delta--down'}`}>{`${t(`releases.scope.change.${change.kind}`)} ${amount}`}</span>;
}

/** The scope of a release over time: start, increase, decrease and now, a chart, and every change (#10). */
export function ScopeReport({ release }: { release: Release }) {
  const { t, i18n } = useTranslation();
  const app = useApp();
  const builtin = useBuiltin();
  const uid = useId();
  const [unit, setUnit] = useReportUnit();
  const language = i18n.resolvedLanguage ?? 'en';
  const pointsShown = builtin.shown('story', 'points');
  const shownUnit: ReportUnit = pointsShown ? unit : 'tickets';
  const report = scopeReport(release, app.events, todayIso());

  if (!report) return <p className="muted">{t('releases.scope.empty')}</p>;

  const storyOf = (storyId: string) => app.stories.find((story) => story.id === storyId);
  const unitName = t(`releases.scope.unit.${shownUnit}`);
  const label = t('releases.scope.chartLabel', {
    unit: unitName,
    start: amountOf(report.start, shownUnit),
    now: amountOf(report.now, shownUnit),
    done: amountOf(report.nowDone, shownUnit)
  });

  return (
    <div className="scope">
      <div className="scope__head">
        {pointsShown ? (
          <div className="unit-switch" role="group" aria-label={t('releases.scope.unit.label')}>
            {(['points', 'tickets'] as const).map((choice) => (
              <button key={choice} type="button" className={`btn${shownUnit === choice ? ' btn--pressed' : ''}`} aria-pressed={shownUnit === choice} onClick={() => setUnit(choice)}>
                {t(`releases.scope.unit.${choice}`)}
              </button>
            ))}
          </div>
        ) : (
          <span />
        )}
        <span className="muted">{t('releases.scope.recordedSince', { date: formatDay(report.recordedSince, language) })}</span>
      </div>

      <dl className="scope__kpis">
        <div className="scope__kpi">
          <dt>{t('releases.scope.kpi.start')}</dt>
          <dd>{amountOf(report.start, shownUnit)}</dd>
        </div>
        <div className="scope__kpi">
          <dt>{t('releases.scope.kpi.increase')}</dt>
          <dd className="scope__up">{`+${amountOf(report.increase, shownUnit)}`}</dd>
        </div>
        <div className="scope__kpi">
          <dt>{t('releases.scope.kpi.decrease')}</dt>
          <dd className="scope__down">{`−${amountOf(report.decrease, shownUnit)}`}</dd>
        </div>
        <div className="scope__kpi">
          <dt>{t('releases.scope.kpi.now')}</dt>
          <dd>{amountOf(report.now, shownUnit)}</dd>
        </div>
      </dl>

      {report.days.length >= 2 ? (
        <figure className="scope__chart">
          <div className="scope__legend">
            <span className="scope__key scope__key--scope">{t('releases.scope.legend.scope')}</span>
            <span className="scope__key scope__key--done">{t('releases.scope.legend.done')}</span>
            <span className="scope__key scope__key--up">{t('releases.scope.legend.increase')}</span>
            <span className="scope__key scope__key--down">{t('releases.scope.legend.decrease')}</span>
          </div>
          <Chart report={report} unit={shownUnit} label={label} />
          <details>
            <summary>{t('releases.scope.showTable')}</summary>
            <div className="release-table-wrap">
              <table className="release-table" aria-label={label}>
                <thead>
                  <tr>
                    <th scope="col">{t('releases.scope.table.date')}</th>
                    <th scope="col">{t('releases.scope.table.scope')}</th>
                    <th scope="col">{t('releases.scope.table.done')}</th>
                    <th scope="col">{t('releases.scope.table.change')}</th>
                  </tr>
                </thead>
                <tbody>
                  {report.days.map((day) => (
                    <tr key={day.day}>
                      <th scope="row">{formatDay(day.day, language)}</th>
                      <td>{amountOf(day.scope, shownUnit)}</td>
                      <td>{amountOf(day.done, shownUnit)}</td>
                      <td>{amountOf(day.change, shownUnit) === 0 ? '–' : signed(amountOf(day.change, shownUnit))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </figure>
      ) : (
        <p className="muted">{t('releases.scope.tooFew')}</p>
      )}

      <h3 className="scope__heading" id={`${uid}-changes`}>
        {t('releases.scope.changes')}
      </h3>
      {report.changes.length === 0 ? (
        <p className="muted">{t('releases.scope.noChanges')}</p>
      ) : (
        <div className="release-table-wrap">
          <table className="release-table" aria-labelledby={`${uid}-changes`}>
            <thead>
              <tr>
                <th scope="col">{t('releases.scope.table.date')}</th>
                <th scope="col">{t('releases.scope.story')}</th>
                <th scope="col">{t('releases.scope.table.change')}</th>
              </tr>
            </thead>
            <tbody>
              {[...report.changes].reverse().map((change, index) => {
                const story = storyOf(change.storyId);
                return (
                  <tr key={`${change.at}-${change.storyId}-${index}`}>
                    <th scope="row">{formatDay(change.day, language)}</th>
                    <td>
                      <span className="release-table__code">{change.code}</span> {story ? story.title : t('releases.scope.deletedStory')}
                    </td>
                    <td>
                      <ChangeText change={change} unit={shownUnit} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
