import type { HTMLAttributes } from 'react';
import { cx } from './classes';

/** A small rounded value, for example the story points on a card. */
export function Pill({ className, ...rest }: HTMLAttributes<HTMLSpanElement>) {
  return <span className={cx('pill', className)} {...rest} />;
}
