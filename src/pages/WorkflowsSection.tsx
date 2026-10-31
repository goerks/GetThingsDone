import { useId, useState, type CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { statusLabel } from '../components/statusLabel';
import { CATEGORY_COLORS, STATUS_CATEGORIES, statusColor, statusesIn } from '../domain/statuses';
import type { StatusCategory } from '../domain/types';
import { WORKFLOW_END, canBeFree, canDelete, canMove, canSwitchOffStart, hasExceptions, leadsToEnd, setEnabled, setFree, setStart, setTransition, startStatuses } from '../domain/workflow';
import { useApp } from '../state/AppState';
import { WorkflowDiagram } from './WorkflowDiagram';
import { WorkflowVersions } from './WorkflowVersions';
import { DIAGRAM_START } from '../domain/workflowDiagram';

/** A target of a transition as a toggle button: on means allowed. */
function Chip({ on, label, name, end, disabled, title, onToggle }: { on: boolean; label: string; name: string; end?: boolean; disabled?: boolean; title?: string; onToggle: () => void }) {
  return (
    <button type="button" className={`workflow-chip${on ? ' workflow-chip--on' : ''}${end ? ' workflow-chip--end' : ''}`} aria-pressed={on} aria-label={name} disabled={disabled} title={title ?? name} onClick={onToggle}>
      <span aria-hidden="true" className="workflow-chip__mark">
        {on ? '✓' : ''}
      </span>
      {label}
    </button>
  );
}

/** One status as a row: its name and the targets a story may move to next. */
function StatusRow({ id }: { id: string }) {
  const { t } = useTranslation();
  const app = useApp();
  const { workflow } = app.settings;
  const name = statusLabel(t, app.statuses, id);
  const set = (to: string): void => app.setWorkflow(setTransition(workflow, id, to, !canMove(workflow, id, to)));
  return (
    <li className="workflow-row" data-status={id}>
      <span className="workflow-row__name" style={{ '--status-color': statusColor(app.statuses, id) } as CSSProperties}>
        {name}
      </span>
      <span className="workflow-row__targets" role="group" aria-label={t('workflow.targetsOf', { name })}>
        <span className="workflow-row__to" aria-hidden="true">
          {t('workflow.to')}
        </span>
        {app.statuses
          .filter((status) => status.id !== id)
          .map((status) => {
            const to = statusLabel(t, app.statuses, status.id);
            return <Chip key={status.id} on={canMove(workflow, id, status.id)} label={to} name={t('workflow.chip.transition', { from: name, to })} onToggle={() => set(status.id)} />;
          })}
        <Chip end on={canDelete(workflow, id)} label={t('workflow.end')} name={t('workflow.chip.end', { from: name })} onToggle={() => set(WORKFLOW_END)} />
      </span>
    </li>
  );
}

/** The switch of a category: free transitions inside it. */
function FreeSwitch({ category }: { category: StatusCategory }) {
  const { t } = useTranslation();
  const app = useApp();
  const { workflow } = app.settings;
  const uid = useId();
  const single = !canBeFree(app.statuses, category);
  const on = !single && workflow.story.free[category];
  const exceptions = hasExceptions(workflow, app.statuses, category);
  const name = t(`statusValues.category.${category}`);
  return (
    <label className="workflow-free" htmlFor={uid}>
      <input
        id={uid}
        type="checkbox"
        role="switch"
        className="definition-switch workflow-free__switch"
        checked={on}
        disabled={single}
        aria-label={t('workflow.free.label', { name })}
        onChange={(event) => app.setWorkflow(setFree(workflow, app.statuses, category, event.target.checked))}
      />
      <span>{t('workflow.free.label', { name })}</span>
      {single && <span className="badge badge--off">{t('workflow.free.single')}</span>}
      {exceptions && <span className="badge">{t('workflow.free.exceptions')}</span>}
    </label>
  );
}

/** The row of the start: the statuses a new story may start in. */
function StartRow() {
  const { t } = useTranslation();
  const app = useApp();
  const { workflow } = app.settings;
  const starts = startStatuses(workflow, app.statuses);
  return (
    <section className="status-group workflow-group" aria-label={t('workflow.start.title')} data-part="start" style={{ '--category-color': 'var(--text)' } as CSSProperties}>
      <h3 className="status-group__head">{t('workflow.start.title')}</h3>
      <ul className="workflow-rows">
        <li className="workflow-row">
          <span className="workflow-row__name workflow-row__name--start">{t('workflow.start.row')}</span>
          <span className="workflow-row__targets" role="group" aria-label={t('workflow.start.group')}>
            <span className="workflow-row__to" aria-hidden="true">
              {t('workflow.to')}
            </span>
            {statusesIn(app.statuses, 'not_started').map((status) => {
              const name = statusLabel(t, app.statuses, status.id);
              const on = starts.includes(status.id);
              const last = on && !canSwitchOffStart(workflow, app.statuses, status.id);
              return (
                <Chip
                  key={status.id}
                  on={on}
                  label={name}
                  name={t('workflow.chip.start', { status: name })}
                  disabled={last}
                  title={last ? t('workflow.chip.lastStart') : t('workflow.chip.start', { status: name })}
                  onToggle={() => app.setWorkflow(setStart(workflow, app.statuses, status.id, !on))}
                />
              );
            })}
          </span>
        </li>
      </ul>
      {starts.length === 1 && <p className="workflow-group__note muted">{t('workflow.start.last')}</p>}
    </section>
  );
}

/** The diagram view (#49, AC13 to AC15): the diagram, and below it the targets of the chosen status or of the start. */
function DiagramView() {
  const { t } = useTranslation();
  const app = useApp();
  const [selected, setSelected] = useState<string | null>(null);
  const chosen = selected && selected !== DIAGRAM_START && app.statuses.some((status) => status.id === selected) ? selected : null;
  return (
    <div className="workflow-diagram-view">
      <p className="muted">{t('workflow.diagram.hint')}</p>
      <WorkflowDiagram selected={selected} onSelect={setSelected} />
      <div className="workflow-free-row">
        {STATUS_CATEGORIES.filter((category) => statusesIn(app.statuses, category).length > 0).map((category) => (
          <FreeSwitch key={category} category={category} />
        ))}
      </div>
      <div className="workflow-diagram-edit" data-part="diagram-edit" aria-live="polite">
        {selected === DIAGRAM_START ? (
          <StartRow />
        ) : chosen ? (
          <ul className="workflow-rows">
            <StatusRow key={chosen} id={chosen} />
          </ul>
        ) : (
          <p className="muted">{t('workflow.diagram.choose')}</p>
        )}
      </div>
    </div>
  );
}

/**
 * Settings › Workflows (#49): the allowed transitions between the status values as a list "from here to …". Off by default,
 * like the definitions: a switch at the top activates it; while it is off nothing is restricted and what was set is kept.
 */
export function WorkflowsSection() {
  const { t } = useTranslation();
  const app = useApp();
  const { workflow } = app.settings;
  const hintId = useId();
  const [view, setView] = useState<'diagram' | 'list'>('diagram');
  return (
    <div className="map-settings workflows-settings">
      <div className="map-settings__head">
        <h2>{t('workflow.title')}</h2>
      </div>
      <p className="muted">{t('workflow.intro')}</p>
      <section className={`definition-listcard${workflow.enabled ? '' : ' definition-listcard--off'}`} aria-label={t('workflow.settings.activate')}>
        <div className="definition-listcard__head">
          <input
            type="checkbox"
            role="switch"
            className="definition-switch"
            checked={workflow.enabled}
            aria-label={t('workflow.settings.activate')}
            aria-describedby={hintId}
            onChange={(event) => app.setWorkflow(setEnabled(workflow, event.target.checked))}
          />
          <div className="definition-listcard__title">
            <h3>{t('workflow.settings.activate')}</h3>
            <p id={hintId} className="muted">
              {t(workflow.enabled ? 'workflow.settings.hintOn' : 'workflow.settings.hintOff')}
            </p>
          </div>
        </div>
      </section>
      {workflow.enabled && (
        <div className="workflow-editor" data-part="editor">
          {!leadsToEnd(workflow, app.statuses) && (
            <p role="alert" className="notice notice--error workflow-warning">
              {t('workflow.warning.noEnd')}
            </p>
          )}
          <div className="workflow-view" role="group" aria-label={t('workflow.view.label')}>
            {(['diagram', 'list'] as const).map((item) => (
              <button key={item} type="button" className={`btn${view === item ? ' is-on' : ''}`} aria-pressed={view === item} onClick={() => setView(item)}>
                {t(`workflow.view.${item}`)}
              </button>
            ))}
          </div>
          {view === 'diagram' ? (
            <DiagramView />
          ) : (
            <>
              <p className="muted">{t('workflow.hint')}</p>
              <StartRow />
              {STATUS_CATEGORIES.map((category) => {
                const statuses = statusesIn(app.statuses, category);
                if (statuses.length === 0) return null;
                return (
                  <section key={category} className="status-group workflow-group" aria-label={t(`statusValues.category.${category}`)} data-category={category} style={{ '--category-color': CATEGORY_COLORS[category] } as CSSProperties}>
                    <h3 className="status-group__head">
                      <span>{t(`statusValues.category.${category}`)}</span>
                      <FreeSwitch category={category} />
                    </h3>
                    <ul className="workflow-rows">
                      {statuses.map((status) => (
                        <StatusRow key={status.id} id={status.id} />
                      ))}
                    </ul>
                  </section>
                );
              })}
            </>
          )}
          <WorkflowVersions />
        </div>
      )}
    </div>
  );
}
