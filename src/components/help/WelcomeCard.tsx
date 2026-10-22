import { useTranslation } from 'react-i18next';
import { useHelp } from '../../state/Help';
import { Button } from '../../ui';

/** The invitation on the first start. It never blocks anything and goes away for good with one click. */
export function WelcomeCard() {
  const { t } = useTranslation();
  const help = useHelp();
  if (help.state.invitation !== 'pending') return null;
  return (
    <div className="welcome" role="group" aria-label={t('help.invitation.label')}>
      <div className="welcome__text">
        <strong>{t('help.invitation.title')}</strong>
        <span className="muted">{t('help.invitation.text')}</span>
      </div>
      <Button type="button" variant="primary" onClick={help.startTour}>
        {t('help.invitation.start')}
      </Button>
      <Button type="button" variant="ghost" onClick={help.declineInvitation}>
        {t('help.invitation.decline')}
      </Button>
    </div>
  );
}
