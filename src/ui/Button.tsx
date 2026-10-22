import type { ComponentProps } from 'react';
import { cx } from './classes';

export type ButtonVariant = 'default' | 'primary' | 'quiet' | 'ghost' | 'danger' | 'danger-quiet' | 'link';

interface Props extends ComponentProps<'button'> {
  /** Primary: the one main action of a view. Danger: deletes or discards. Quiet, ghost and link: secondary actions. */
  variant?: ButtonVariant;
  size?: 'default' | 'small';
  /** A toggle button that is switched on. */
  pressed?: boolean;
}

/** The button of the product. Like a plain `button` it has no default `type`: say `type="button"` or `type="submit"`. */
export function Button({ variant = 'default', size = 'default', pressed = false, className, ...rest }: Props) {
  return <button className={cx('btn', variant !== 'default' && `btn--${variant}`, size === 'small' && 'btn--small', pressed && 'btn--pressed', className)} {...rest} />;
}
