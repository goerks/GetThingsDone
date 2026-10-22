import type { ComponentProps } from 'react';
import { cx } from './classes';

/** Multi-line field. */
export function Textarea({ className, ...rest }: ComponentProps<'textarea'>) {
  return <textarea className={cx('input', className)} {...rest} />;
}
