import type { ComponentProps } from 'react';
import { cx } from './classes';

/** Single-line field for text, numbers and dates. Mark a wrong entry with `aria-invalid`. */
export function TextInput({ className, ...rest }: ComponentProps<'input'>) {
  return <input className={cx('input', className)} {...rest} />;
}
