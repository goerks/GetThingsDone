import type { ComponentProps } from 'react';
import { cx } from './classes';

/** A button that reads as a link inside a line of text, for example "Show all". Use `Button` for a real action. */
export function TextButton({ className, ...rest }: ComponentProps<'button'>) {
  return <button className={cx('text-btn', className)} {...rest} />;
}
