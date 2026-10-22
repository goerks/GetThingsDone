import type { Meta, StoryObj } from '@storybook/react-vite';
import { userEvent, within } from 'storybook/test';
import { Button, type ButtonVariant } from './Button';

const VARIANTS: { variant: ButtonVariant; use: string }[] = [
  { variant: 'default', use: 'Everyday actions' },
  { variant: 'primary', use: 'The one main action of a view' },
  { variant: 'quiet', use: 'Secondary action next to a primary one' },
  { variant: 'ghost', use: 'Lightweight action in a toolbar' },
  { variant: 'danger', use: 'Deletes or discards' },
  { variant: 'danger-quiet', use: 'Deletes, in a list row' },
  { variant: 'link', use: 'Looks like a link, acts like a button' }
];

const meta: Meta<typeof Button> = {
  title: 'Components/Button',
  component: Button,
  args: { children: 'Save', type: 'button' },
  argTypes: { variant: { control: 'select', options: VARIANTS.map((item) => item.variant) }, size: { control: 'inline-radio', options: ['default', 'small'] } }
};
export default meta;
type Story = StoryObj<typeof Button>;

export const Playground: Story = {};

/** Every variant in the normal and the small size, enabled, switched on and disabled. */
export const Variants: Story = {
  render: () => (
    <div className="catalogue-states">
      <span />
      <span className="catalogue-state-label">Normal</span>
      <span className="catalogue-state-label">Small</span>
      <span className="catalogue-state-label">Pressed</span>
      <span className="catalogue-state-label">Disabled</span>
      {VARIANTS.map(({ variant, use }) => (
        <div key={variant} style={{ display: 'contents' }}>
          <span className="catalogue-state-label" title={use}>
            {variant}
          </span>
          <Button type="button" variant={variant}>
            Save
          </Button>
          <Button type="button" variant={variant} size="small">
            Save
          </Button>
          <Button type="button" variant={variant} pressed aria-pressed>
            Save
          </Button>
          <Button type="button" variant={variant} disabled>
            Save
          </Button>
        </div>
      ))}
    </div>
  )
};

export const Hover: Story = {
  args: { variant: 'primary' },
  play: async ({ canvasElement }) => {
    await userEvent.hover(within(canvasElement).getByRole('button'));
  }
};

export const Focus: Story = {
  args: { variant: 'primary' },
  play: async () => {
    await userEvent.tab();
  }
};
