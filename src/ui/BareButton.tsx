import type { ComponentProps } from 'react';

/**
 * A button without a look of its own, for the feature-specific ones (cards, chips, rows, toggles, tabs). The feature
 * gives it its class. Like a plain `button` it has no default `type`. Use `Button` for an action with the look of the product.
 */
export function BareButton(props: ComponentProps<'button'>) {
  return <button {...props} />;
}
