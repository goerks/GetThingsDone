import type { ComponentProps } from 'react';

interface Props extends Omit<ComponentProps<'input'>, 'type'> {
  /** Checkbox, or a radio button for one choice of a group. */
  kind?: 'checkbox' | 'radio';
}

/** A bare checkbox or radio button, for tables and rows where the label sits elsewhere. It needs an accessible name. Use `Check` where the label is next to it. */
export function CheckInput({ kind = 'checkbox', ...rest }: Props) {
  return <input type={kind} {...rest} />;
}
