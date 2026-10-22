import type { HTMLAttributes } from 'react';
import { cx } from './classes';

/** A short label with a border, for example a state. The text always says it: colour never carries meaning alone. */
export function Badge({ className, ...rest }: HTMLAttributes<HTMLSpanElement>) {
  return <span className={cx('badge', className)} {...rest} />;
}
