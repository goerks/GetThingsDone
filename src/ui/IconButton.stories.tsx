import type { Meta, StoryObj } from '@storybook/react-vite';
import { userEvent, within } from 'storybook/test';
import { PencilIcon, TrashIcon } from '../components/icons';
import { IconButton } from './IconButton';

const meta: Meta<typeof IconButton> = {
  title: 'Components/IconButton',
  component: IconButton,
  args: { type: 'button', 'aria-label': 'Edit', children: <PencilIcon /> }
};
export default meta;
type Story = StoryObj<typeof IconButton>;

export const Playground: Story = {};

export const Variants: Story = {
  render: () => (
    <div className="catalogue-row">
      <IconButton type="button" aria-label="Edit">
        <PencilIcon />
      </IconButton>
      <IconButton type="button" quiet aria-label="Edit">
        <PencilIcon />
      </IconButton>
      <IconButton type="button" quiet on aria-pressed aria-label="Delete (on)">
        <TrashIcon />
      </IconButton>
      <IconButton type="button" disabled aria-label="Edit (disabled)">
        <PencilIcon />
      </IconButton>
    </div>
  )
};

export const Hover: Story = {
  play: async ({ canvasElement }) => {
    await userEvent.hover(within(canvasElement).getByRole('button'));
  }
};

export const Focus: Story = {
  play: async () => {
    await userEvent.tab();
  }
};
