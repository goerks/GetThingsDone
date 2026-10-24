import { useId, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { MAX_INITIALS, freeInitials, initialsFollowName, storiesOfMember, type MemberProblem } from '../domain/members';
import type { Member } from '../domain/types';
import { teamFromService } from '../domain/syncOwners';
import { serviceName } from '../sync/syncT';
import { useApp } from '../state/AppState';
import { FeatureTab } from './FeatureTab';

/** The form for a new or an existing member: name and initials. Saves with Enter, cancels with Escape. */
function MemberForm({ member, onDone }: { member: Member | null; onDone: () => void }) {
  const { t } = useTranslation();
  const app = useApp();
  const uid = useId();
  const [name, setName] = useState(member?.name ?? '');
  // The initials follow the name until they are typed by hand.
  const [initials, setInitials] = useState(member?.initials ?? '');
  const [byHand, setByHand] = useState(member !== null && !initialsFollowName(app.members, member));
  const [problem, setProblem] = useState<MemberProblem | null>(null);
  const shownInitials = byHand ? initials : freeInitials(name, app.members.filter((item) => item.id !== member?.id));

  const submit = (event: FormEvent): void => {
    event.preventDefault();
    const typed = byHand ? initials : undefined;
    const result = member ? app.updateMember(member.id, { name, ...(typed !== undefined ? { initials: typed } : {}) }) : app.createMember(name, typed);
    if (!result.ok) {
      setProblem(result.problem);
      return;
    }
    onDone();
  };

  const nameProblem = problem === 'nameEmpty' || problem === 'nameTaken';
  const initialsProblem = problem === 'initialsEmpty' || problem === 'initialsTooLong' || problem === 'initialsTaken';

  return (
    <form
      className="team__form"
      onSubmit={submit}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.stopPropagation();
          onDone();
        }
      }}
      noValidate
    >
      <div className="field">
        <label htmlFor={`${uid}-name`}>{t('team.name')}</label>
        <input
          id={`${uid}-name`}
          className="input"
          value={name}
          onChange={(event) => {
            setName(event.target.value);
            setProblem(null);
          }}
          aria-invalid={nameProblem || undefined}
          aria-describedby={problem ? `${uid}-problem` : undefined}
          autoFocus
        />
      </div>
      <div className="field team__initials">
        <label htmlFor={`${uid}-initials`}>{t('team.initials')}</label>
        <input
          id={`${uid}-initials`}
          className="input"
          value={shownInitials}
          maxLength={MAX_INITIALS + 4}
          onChange={(event) => {
            setInitials(event.target.value);
            setByHand(true);
            setProblem(null);
          }}
          aria-invalid={initialsProblem || undefined}
          aria-describedby={problem ? `${uid}-problem` : undefined}
        />
      </div>
      <div className="form__actions team__actions">
        <button type="submit" className="btn btn--primary">
          {t('team.save')}
        </button>
        <button type="button" className="btn" onClick={onDone}>
          {t('team.cancel')}
        </button>
      </div>
      {problem && (
        <p id={`${uid}-problem`} role="alert" className="field-error team__problem">
          {t(`team.problem.${problem}`, { count: MAX_INITIALS })}
        </p>
      )}
    </form>
  );
}

function MemberRow({ member }: { member: Member }) {
  const { t } = useTranslation();
  const app = useApp();
  const uid = useId();
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const count = storiesOfMember(app.stories, member.id).length;

  if (editing) {
    return (
      <li className="team__item team__item--editing">
        <MemberForm member={member} onDone={() => setEditing(false)} />
      </li>
    );
  }
  return (
    <li className="team__item">
      <span className="assignee" aria-hidden="true">
        <span>{member.initials}</span>
      </span>
      <span className="team__name">{member.name}</span>
      <span className="muted team__short">{t('team.initialsOf', { initials: member.initials })}</span>
      {confirming ? (
        <div role="group" aria-labelledby={`${uid}-confirm`} className="danger__confirm team__confirm">
          <p id={`${uid}-confirm`}>{t('team.removeConfirm', { name: member.name, count })}</p>
          <div className="form__actions">
            <button type="button" className="btn btn--danger" onClick={() => app.removeMember(member.id)}>
              {t('team.removeYes')}
            </button>
            <button type="button" className="btn" onClick={() => setConfirming(false)} autoFocus>
              {t('team.cancel')}
            </button>
          </div>
        </div>
      ) : (
        <span className="team__buttons">
          <button type="button" className="btn" aria-label={t('team.change', { name: member.name })} onClick={() => setEditing(true)}>
            {t('team.changeShort')}
          </button>
          <button
            type="button"
            className="btn btn--danger-quiet"
            aria-label={t('team.remove', { name: member.name })}
            onClick={() => (count > 0 ? setConfirming(true) : app.removeMember(member.id))}
          >
            {t('team.removeShort')}
          </button>
        </span>
      )}
    </li>
  );
}

/**
 * Settings › Team (#18): the people stories can be assigned to. A plain list, no accounts. Everything is saved at once.
 */
export function TeamSection() {
  const { t } = useTranslation();
  const app = useApp();
  const [adding, setAdding] = useState(false);
  const fromService = teamFromService(app.settings);

  return (
    <FeatureTab feature="team">
      {fromService && (
        <p className="hint hint--info" role="note">
          {t('team.fromService', { service: serviceName(t, app.settings.sync.service) })}
        </p>
      )}
      <div className="team" inert={fromService}>
        <p className="muted">{t('team.intro')}</p>
        {app.members.length === 0 ? (
          <p className="hint hint--info" role="note">
            {t('team.empty')}
          </p>
        ) : (
          <ul className="team__list" aria-label={t('team.listLabel')}>
            {app.members.map((member) => (
              <MemberRow key={member.id} member={member} />
            ))}
          </ul>
        )}
        {adding ? (
          <MemberForm member={null} onDone={() => setAdding(false)} />
        ) : (
          <div>
            <button type="button" className="btn btn--primary" onClick={() => setAdding(true)}>
              {t('team.add')}
            </button>
          </div>
        )}
      </div>
    </FeatureTab>
  );
}
