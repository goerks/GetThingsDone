import { useEffect, useId, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { statusLabel } from '../components/statusLabel';
import { STATUS_CATEGORIES, statusesIn } from '../domain/statuses';
import { WORKFLOW_END, canDelete, canMove, startStatuses } from '../domain/workflow';
import { DIAGRAM_START, layoutDiagram, type Orientation } from '../domain/workflowDiagram';
import { useApp } from '../state/AppState';

const NARROW = '(max-width: 640px)';

/** Vertical on a narrow screen, else horizontal. Without `matchMedia` (tests) it is horizontal. */
function useOrientation(): Orientation {
  const query = typeof window !== 'undefined' && typeof window.matchMedia === 'function' ? window.matchMedia(NARROW) : null;
  const [narrow, setNarrow] = useState(query?.matches ?? false);
  useEffect(() => {
    if (!query) return undefined;
    const update = (): void => setNarrow(query.matches);
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, [query]);
  return narrow ? 'vertical' : 'horizontal';
}

const MARKER = { forward: 'forward', back: 'back', both: 'forward', start: 'forward', end: 'end' } as const;

/**
 * The workflow as a UML state diagram (#49, AC13): initial and final state, a frame per category, a rounded rectangle per
 * status, arrows for the allowed transitions. A status (or the start) can be chosen with the pointer or the keyboard; the
 * parent shows its targets. A list of all transitions is there for screen readers.
 */
export function WorkflowDiagram({ selected, onSelect }: { selected: string | null; onSelect: (id: string) => void }) {
  const { t } = useTranslation();
  const app = useApp();
  const { workflow } = app.settings;
  const orientation = useOrientation();
  const uid = useId().replace(/:/g, '');
  const model = useMemo(() => layoutDiagram(workflow, app.statuses, orientation), [workflow, app.statuses, orientation]);
  const name = (id: string): string => statusLabel(t, app.statuses, id);
  const marker = (kind: keyof typeof MARKER): string => `url(#${uid}-${MARKER[kind]})`;

  const pick = (id: string) => ({
    tabIndex: 0,
    role: 'button' as const,
    'aria-pressed': selected === id,
    onClick: () => onSelect(id),
    onKeyDown: (event: React.KeyboardEvent) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        onSelect(id);
      }
    }
  });

  // The same transitions as text, for screen readers.
  const ordered = STATUS_CATEGORIES.flatMap((category) => statusesIn(app.statuses, category));
  const starts = startStatuses(workflow, app.statuses);

  return (
    <div className="workflow-diagram" data-part="diagram" data-orientation={orientation}>
      {model.complete && <p className="muted workflow-diagram__note">{t('workflow.diagram.complete')}</p>}
      <div className="workflow-diagram__scroll">
        <svg viewBox={`0 0 ${model.width} ${model.height}`} width={model.width} height={model.height} role="group" aria-label={t('workflow.diagram.label')}>
          <defs>
            {(['forward', 'back', 'end'] as const).map((kind) => (
              <g key={kind}>
                <marker id={`${uid}-${kind}`} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="9" markerHeight="9" orient="auto">
                  <path className={`wd-head wd-head--${kind}`} d="M1 1L9 5L1 9" />
                </marker>
                {kind === 'forward' && (
                  <marker id={`${uid}-forward-start`} viewBox="0 0 10 10" refX="1" refY="5" markerWidth="9" markerHeight="9" orient="auto-start-reverse">
                    <path className="wd-head wd-head--forward" d="M1 1L9 5L1 9" />
                  </marker>
                )}
              </g>
            ))}
          </defs>
          {model.frames.map((frame) => (
            <g key={frame.category} className="wd-frame" data-category={frame.category}>
              <rect x={frame.x} y={frame.y} width={frame.width} height={frame.height} rx={14} />
              <text x={frame.title.x} y={frame.title.y}>
                {t(`statusValues.category.${frame.category}`)}
              </text>
              <line x1={frame.divider.x1} y1={frame.divider.y1} x2={frame.divider.x2} y2={frame.divider.y2} />
            </g>
          ))}
          {model.edges.map((edge) => (
            <g key={edge.id}>
              <path
                className={`wd-edge wd-edge--${edge.kind}`}
                data-edge={edge.kind}
                data-from={edge.from}
                data-to={edge.to}
                d={edge.d}
                fill="none"
                markerStart={edge.kind === 'both' ? `url(#${uid}-forward-start)` : undefined}
                markerEnd={edge.head ? marker(edge.kind) : undefined}
              />
              {edge.label && (
                <text className="wd-label" x={edge.label.x} y={edge.label.y} textAnchor={edge.label.anchor}>
                  {t('workflow.diagram.free')}
                </text>
              )}
            </g>
          ))}
          {model.junctions.map((dot) => (
            <circle key={`${dot.x}:${dot.y}`} className="wd-junction" cx={dot.x} cy={dot.y} r={4.5} />
          ))}
          <g className={`wd-start${selected === DIAGRAM_START ? ' wd-on' : ''}`} {...pick(DIAGRAM_START)} aria-label={t('workflow.diagram.start')}>
            <circle cx={model.start.x} cy={model.start.y} r={model.start.r} />
            <circle className="wd-hit" cx={model.start.x} cy={model.start.y} r={model.start.r + 8} />
          </g>
          <g className="wd-final" aria-hidden="true">
            <circle className="wd-final__ring" cx={model.end.x} cy={model.end.y} r={model.end.r} />
            <circle cx={model.end.x} cy={model.end.y} r={model.end.r - 6} />
          </g>
          {model.states.map((state) => (
            <g key={state.id} className={`wd-state${selected === state.id ? ' wd-on' : ''}`} data-status={state.id} {...pick(state.id)} aria-label={name(state.id)}>
              <rect x={state.x} y={state.y} width={state.width} height={state.height} rx={12} />
              <text x={state.x + state.width / 2} y={state.y + state.height / 2 + 4.5} textAnchor="middle">
                {name(state.id)}
              </text>
            </g>
          ))}
        </svg>
      </div>
      <ul className="sr-only" aria-label={t('workflow.diagram.transitions')}>
        {starts.map((id) => (
          <li key={`start-${id}`}>{t('workflow.chip.start', { status: name(id) })}</li>
        ))}
        {ordered.flatMap((from) => [
          ...ordered.filter((to) => to.id !== from.id && canMove(workflow, from.id, to.id)).map((to) => <li key={`${from.id}>${to.id}`}>{t('workflow.chip.transition', { from: name(from.id), to: name(to.id) })}</li>),
          ...(canMove(workflow, from.id, WORKFLOW_END) && canDelete(workflow, from.id) ? [<li key={`${from.id}>end`}>{t('workflow.chip.end', { from: name(from.id) })}</li>] : [])
        ])}
      </ul>
    </div>
  );
}
