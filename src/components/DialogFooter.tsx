import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

interface Props {
  /** Label of the primary button, which submits the form. */
  submit: string;
  onCancel: () => void;
  /** More buttons between "Cancel" and the primary button, such as "Add and add another". */
  children?: ReactNode;
}

/** The footer of every create dialog: "Cancel" and the primary button at the right, (#32, U3). */
export function DialogFooter({ submit, onCancel, children }: Props) {
  const { t } = useTranslation();
  return (
    <div className="create-footer">
      <div className="form__actions create-footer__buttons">
        <button type="button" className="btn" onClick={onCancel}>
          {t('newStory.cancel')}
        </button>
        {children}
        <button type="submit" className="btn btn--primary">
          {submit}
        </button>
      </div>
    </div>
  );
}
