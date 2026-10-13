import { useTranslation } from 'react-i18next';
import { useHelp } from '../../state/Help';

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
      <button type="button" className="btn btn--primary" onClick={help.startTour}>
        {t('help.invitation.start')}
      </button>
      <button type="button" className="btn btn--ghost" onClick={help.declineInvitation}>
        {t('help.invitation.decline')}
      </button>
    </div>
  );
}
