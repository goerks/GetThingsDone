import type { ComponentProps } from 'react';
import { cx } from './classes';

/** The grip that picks up a row or card with the mouse or the keyboard. It needs an accessible name (`aria-label`). */
export function DragHandle({ className, ...rest }: ComponentProps<'button'>) {
  return <button type="button" className={cx('drag-handle', className)} {...rest} />;
}
