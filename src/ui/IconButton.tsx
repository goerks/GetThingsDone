import type { ComponentProps } from 'react';
import { cx } from './classes';

interface Props extends ComponentProps<'button'> {
  /** No border until hover: for rows and cards. */
  quiet?: boolean;
  /** A toggle that is switched on. */
  on?: boolean;
}

/** A button that only shows an icon. It needs an accessible name (`aria-label` or `title`). */
export function IconButton({ quiet = false, on = false, className, ...rest }: Props) {
  return <button className={cx('icon-btn', quiet && 'icon-btn--quiet', on && 'icon-btn--on', className)} {...rest} />;
}
