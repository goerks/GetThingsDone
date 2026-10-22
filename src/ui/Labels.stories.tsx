import type { Meta, StoryObj } from '@storybook/react-vite';
import { Badge } from './Badge';
import { Pill } from './Pill';

const meta: Meta = { title: 'Components/Badge and pill' };
export default meta;
type Story = StoryObj;

export const Badges: Story = {
  render: () => (
    <div className="catalogue-row">
      <Badge>Release 1.0</Badge>
      <Badge>Sprint 4</Badge>
    </div>
  )
};

export const Pills: Story = {
  render: () => (
    <div className="catalogue-row">
      <Pill>3</Pill>
      <Pill>13</Pill>
    </div>
  )
};
