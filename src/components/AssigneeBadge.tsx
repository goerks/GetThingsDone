import { useTranslation } from 'react-i18next';
import { assigneeOf } from '../domain/members';
import type { Story } from '../domain/types';
import { useApp } from '../state/AppState';
import { useFeature } from './useFeature';

interface Props {
  story: Pick<Story, 'assigneeId'>;
  /** Places the badge at the top right of a board card. */
  corner?: boolean;
}

/**
 * The initials of the member a story is assigned to, in a round badge (#18). The full name is the tooltip and the
 * text for assistive technology. A story without assignee shows a dashed, empty badge. A team without members shows
 * nothing, as there is nobody to assign.
 */
export function AssigneeBadge({ story, corner = false }: Props) {
  const { t } = useTranslation();
  const app = useApp();
  const on = useFeature('team');
  const member = assigneeOf(app.members, story);
  if (!on || (!member && app.members.length === 0)) return null;
  const text = member ? t('team.assignedTo', { name: member.name }) : t('team.unassigned');
  return (
    <span className={`assignee${member ? '' : ' assignee--none'}${corner ? ' assignee--corner' : ''}`} role="img" aria-label={text} title={member ? member.name : text}>
      <span aria-hidden="true">{member ? member.initials : '–'}</span>
    </span>
  );
}
