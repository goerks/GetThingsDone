import type { ComponentProps } from 'react';

/** A field without a look of its own (search box, file picker, text edited in place). Use `TextInput` for a form field. */
export function BareInput(props: ComponentProps<'input'>) {
  return <input {...props} />;
}
