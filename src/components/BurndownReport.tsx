import { useTranslation } from 'react-i18next';
import { burndownReport, type BurndownReport as Report } from '../domain/burndown';
import type { Amount } from '../domain/history';
import { todayIso } from '../domain/sprints';
import type { Release } from '../domain/types';
import { useApp } from '../state/AppState';
import { formatDay } from './releaseFormat';
import { niceMax } from './ScopeReport';
import { useBuiltin } from './useBuiltin';
import { useReportUnit, type ReportUnit } from './useReportUnit';
import { Button } from '../ui';

const W = 680;
const H = 284;
const LEFT = 48;
const RIGHT = 660;
const TOP = 32;
const BOTTOM = 250;

const amountOf = (amount: Amount, unit: ReportUnit): number => (unit === 'points' ? amount.points : amount.tickets);
const signed = (value: number): string => (value > 0 ? `+${value}` : value < 0 ? `−${Math.abs(value)}` : '±0');
const round = (value: number): number => Math.round(value * 10) / 10;

function Chart({ report, unit, label }: { report: Report; unit: ReportUnit; label: string }) {
  const { t, i18n } = useTranslation();
  const language = i18n.resolvedLanguage ?? 'en';
  const days = report.days;
  const nowIndex = days.findIndex((day) => day.day === report.today);
  const remaining = days.slice(0, nowIndex + 1).map((day) => amountOf(day.remaining ?? { tickets: 0, points: 0 }, unit));
  const idealIndexes = days.flatMap((day, index) => (day.ideal ? [index] : []));
  const highest = Math.max(...remaining, ...idealIndexes.map((index) => amountOf(days[index].ideal as Amount, unit)));
  const { max, step } = niceMax(highest);
  const x = (index: number): number => LEFT + (index / (days.length - 1)) * (RIGHT - LEFT);
  const y = (value: number): number => BOTTOM - (value / max) * (BOTTOM - TOP);
  const stepPath = `M${x(0)},${y(remaining[0])}` + remaining.slice(1).map((value, index) => ` H${x(index + 1)} V${y(value)}`).join('');
  const yTicks = Array.from({ length: max / step + 1 }, (_, index) => index * step);
  const tickCount = Math.min(5, days.length);
  const xTicks = Array.from({ length: tickCount }, (_, index) => Math.round((index / (tickCount - 1)) * (days.length - 1)));
  const short = (day: string): string => {
    const [year, month, date] = day.split('-').map(Number);
    return new Intl.DateTimeFormat(language, { day: 'numeric', month: 'short' }).format(new Date(year, month - 1, date));
  };
  const first = idealIndexes[0];
  const last = idealIndexes[idealIndexes.length - 1];

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
      {first !== undefined && last !== undefined && (
        <path className="scope-chart__ideal" d={`M${x(first)},${y(amountOf(days[first].ideal as Amount, unit))} L${x(last)},${y(amountOf(days[last].ideal as Amount, unit))}`} />
      )}
      {nowIndex < days.length - 1 && (
        <g>
          <line className="scope-chart__today" x1={x(nowIndex)} x2={x(nowIndex)} y1={TOP} y2={BOTTOM} />
          <text x={x(nowIndex) + 6} y={TOP + 12}>
            {t('releases.burndown.today')}
          </text>
        </g>
      )}
      <path className="scope-chart__scope" d={stepPath} />
      {days.slice(0, nowIndex + 1).map((day, index) => {
        const change = amountOf(day.change, unit);
        if (change === 0) return null;
        return (
          <g key={day.day}>
            <circle className={change > 0 ? 'scope-chart__up' : 'scope-chart__down'} cx={x(index)} cy={y(remaining[index])} r={4.5} />
            <text className="scope-chart__tag" x={x(index)} y={y(remaining[index]) + (change > 0 ? -10 : 18)} textAnchor="middle">
              {signed(change)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

/**
 * The burndown of a release: what is left (scope minus done) per calendar day, with the target line from the start
 * to the end date when both are set, today, and the changes of the scope as signed marks (#10, phase 4).
 */
export function BurndownReport({ release }: { release: Release }) {
  const { t, i18n } = useTranslation();
  const app = useApp();
  const builtin = useBuiltin();
  const [unit, setUnit] = useReportUnit();
  const language = i18n.resolvedLanguage ?? 'en';
  const pointsShown = builtin.shown('story', 'points');
  const shownUnit: ReportUnit = pointsShown ? unit : 'tickets';
  const report = burndownReport(release, app.events, todayIso());

  if (!report) return <p className="muted">{t('releases.scope.empty')}</p>;

  const unitName = t(`releases.scope.unit.${shownUnit}`);
  const amountText = (value: number): string =>
    shownUnit === 'points' ? `${round(value)} ${t('releases.scope.unitShort.points')}` : t('summary.stories', { count: round(value) });
  const label = t('releases.burndown.chartLabel', {
    unit: unitName,
    remaining: amountOf(report.remaining, shownUnit),
    done: amountOf(report.done, shownUnit),
    scope: amountOf(report.scope, shownUnit)
  });
  const against = report.againstIdeal ? round(amountOf(report.againstIdeal, shownUnit)) : null;
  const againstText =
    against === null ? '–' : against > 0 ? t('releases.burndown.against.behind', { amount: amountText(against) }) : against < 0 ? t('releases.burndown.against.ahead', { amount: amountText(-against) }) : t('releases.burndown.against.on');

  return (
    <div className="scope">
      <div className="scope__head">
        {pointsShown ? (
          <div className="unit-switch" role="group" aria-label={t('releases.scope.unit.label')}>
            {(['points', 'tickets'] as const).map((choice) => (
              <Button key={choice} type="button" pressed={shownUnit === choice} aria-pressed={shownUnit === choice} onClick={() => setUnit(choice)}>
                {t(`releases.scope.unit.${choice}`)}
              </Button>
            ))}
          </div>
        ) : (
          <span />
        )}
        <span className="muted">{t('releases.scope.recordedSince', { date: formatDay(report.recordedSince, language) })}</span>
      </div>

      <dl className="scope__kpis">
        <div className="scope__kpi">
          <dt>{t('releases.burndown.kpi.remaining')}</dt>
          <dd>{amountOf(report.remaining, shownUnit)}</dd>
        </div>
        <div className="scope__kpi">
          <dt>{t('releases.burndown.kpi.done')}</dt>
          <dd>{t('releases.burndown.doneOf', { done: amountOf(report.done, shownUnit), scope: amountOf(report.scope, shownUnit) })}</dd>
        </div>
        <div className="scope__kpi">
          <dt>{t('releases.burndown.kpi.target')}</dt>
          <dd className={against !== null && against > 0 ? 'scope__up' : undefined}>{againstText}</dd>
        </div>
      </dl>

      {!report.idealFrom && <p className="hint hint--info">{t('releases.burndown.noLine')}</p>}

      {report.days.length >= 2 ? (
        <figure className="scope__chart">
          <div className="scope__legend">
            <span className="scope__key scope__key--scope">{t('releases.burndown.legend.remaining')}</span>
            {report.idealFrom && <span className="scope__key scope__key--ideal">{t('releases.burndown.legend.ideal')}</span>}
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
                    <th scope="col">{t('releases.burndown.table.remaining')}</th>
                    {report.idealFrom && <th scope="col">{t('releases.burndown.table.ideal')}</th>}
                    <th scope="col">{t('releases.burndown.table.change')}</th>
                  </tr>
                </thead>
                <tbody>
                  {report.days.map((day) => (
                    <tr key={day.day}>
                      <th scope="row">{formatDay(day.day, language)}</th>
                      <td>{day.remaining ? amountOf(day.remaining, shownUnit) : '–'}</td>
                      {report.idealFrom && <td>{day.ideal ? round(amountOf(day.ideal, shownUnit)) : '–'}</td>}
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
      <p className="muted">{t('releases.burndown.explain')}</p>
    </div>
  );
}
