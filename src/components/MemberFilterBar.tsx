import { useTranslation } from 'react-i18next';
import type { MemberFilter } from '../domain/members';
import { useApp } from '../state/AppState';

interface Props {
  filter: MemberFilter;
  onChange: (filter: MemberFilter) => void;
}

/**
 * The filter above the board (#18): all stories, the stories of one team member, or the stories nobody works on.
 * Shown only when the team has members.
 */
export function MemberFilterBar({ filter, onChange }: Props) {
  const { t } = useTranslation();
  const app = useApp();
  if (app.members.length === 0) return null;
  return (
    <div className="member-filter" role="group" aria-label={t('team.filter.label')}>
      <button type="button" className="member-filter__chip" aria-pressed={filter.kind === 'all'} onClick={() => onChange({ kind: 'all' })}>
        {t('team.filter.all')}
      </button>
      {app.members.map((member) => (
        <button
          key={member.id}
          type="button"
          className="member-filter__chip"
          aria-pressed={filter.kind === 'member' && filter.memberId === member.id}
          aria-label={member.name}
          title={member.name}
          onClick={() => onChange({ kind: 'member', memberId: member.id })}
        >
          {member.initials}
        </button>
      ))}
      <button type="button" className="member-filter__chip" aria-pressed={filter.kind === 'none'} onClick={() => onChange({ kind: 'none' })}>
        {t('team.filter.none')}
      </button>
    </div>
  );
}
