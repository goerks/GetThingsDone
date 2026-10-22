import type { ComponentProps } from 'react';

/** A multi-line field without a look of its own (text edited in place). Use `Textarea` for a form field. */
export function BareTextarea(props: ComponentProps<'textarea'>) {
  return <textarea {...props} />;
}
