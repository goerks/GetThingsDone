import type { InputHTMLAttributes, ReactNode } from 'react';
import { cx } from './classes';

interface Props extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'children'> {
  /** Checkbox, or a radio button for one choice of a group. */
  kind?: 'checkbox' | 'radio';
  children: ReactNode;
}

/** A checkbox or radio button with its visible label. */
export function Check({ kind = 'checkbox', className, children, ...rest }: Props) {
  return (
    <label className={cx('check', className)}>
      <input type={kind} {...rest} />
      {children}
    </label>
  );
}
