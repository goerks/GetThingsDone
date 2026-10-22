import type { ComponentProps } from 'react';
import { cx } from './classes';

/** Native choice list. */
export function Select({ className, ...rest }: ComponentProps<'select'>) {
  return <select className={cx('select', className)} {...rest} />;
}
