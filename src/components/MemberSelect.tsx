import { useTranslation } from 'react-i18next';
import { useApp } from '../state/AppState';

interface Props {
  id: string;
  value: string | null | undefined;
  onChange: (memberId: string | null) => void;
}

/** "Nobody" and every team member, with the initials in brackets (#18). */
export function MemberSelect({ id, value, onChange }: Props) {
  const { t } = useTranslation();
  const app = useApp();
  return (
    <select id={id} className="select" value={value ?? ''} onChange={(event) => onChange(event.target.value || null)}>
      <option value="">{t('team.nobody')}</option>
      {app.members.map((member) => (
        <option key={member.id} value={member.id}>
          {member.name} ({member.initials})
        </option>
      ))}
    </select>
  );
}
