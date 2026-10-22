import { useTranslation } from 'react-i18next';
import type { MemberFilter } from '../domain/members';
import { useApp } from '../state/AppState';
import { useFeature } from './useFeature';
import { BareButton } from '../ui';

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
  const on = useFeature('team');
  if (!on || app.members.length === 0) return null;
  return (
    <div className="member-filter" role="group" aria-label={t('team.filter.label')}>
      <BareButton type="button" className="member-filter__chip" aria-pressed={filter.kind === 'all'} onClick={() => onChange({ kind: 'all' })}>
        {t('team.filter.all')}
      </BareButton>
      {app.members.map((member) => (
        <BareButton
          key={member.id}
          type="button"
          className="member-filter__chip"
          aria-pressed={filter.kind === 'member' && filter.memberId === member.id}
          aria-label={member.name}
          title={member.name}
          onClick={() => onChange({ kind: 'member', memberId: member.id })}
        >
          {member.initials}
        </BareButton>
      ))}
      <BareButton type="button" className="member-filter__chip" aria-pressed={filter.kind === 'none'} onClick={() => onChange({ kind: 'none' })}>
        {t('team.filter.none')}
      </BareButton>
    </div>
  );
}
