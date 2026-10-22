import type { Meta, StoryObj } from '@storybook/react-vite';
import { userEvent, within } from 'storybook/test';
import { Check } from './Check';
import { Select } from './Select';
import { Textarea } from './Textarea';
import { TextInput } from './TextInput';

const meta: Meta = { title: 'Components/Form fields' };
export default meta;
type Story = StoryObj;

/** Text, number and date fields, in the normal, filled, wrong and disabled state. */
export const TextInputs: Story = {
  render: () => (
    <div style={{ display: 'grid', gap: 'var(--space-3)', maxWidth: '24rem' }}>
      <TextInput aria-label="Empty" placeholder="Title" />
      <TextInput aria-label="Filled" defaultValue="Login page" />
      <TextInput aria-label="Points" type="number" defaultValue="3" />
      <TextInput aria-label="Date" type="date" defaultValue="2026-10-22" />
      <TextInput aria-label="Wrong" defaultValue="abc" aria-invalid="true" />
      <TextInput aria-label="Disabled" defaultValue="Locked" disabled />
      <Textarea aria-label="Description" rows={3} defaultValue="As a user I want to sign in." />
    </div>
  )
};

export const Selects: Story = {
  render: () => (
    <div style={{ display: 'grid', gap: 'var(--space-3)', maxWidth: '24rem' }}>
      <Select aria-label="Status" defaultValue="doing">
        <option value="todo">To do</option>
        <option value="doing">In progress</option>
        <option value="done">Done</option>
      </Select>
      <Select aria-label="Disabled" disabled>
        <option>Done</option>
      </Select>
    </div>
  )
};

export const Checks: Story = {
  render: () => (
    <div style={{ display: 'grid', gap: 'var(--space-1)' }}>
      <Check defaultChecked>Show only changes</Check>
      <Check>Start the next sprint</Check>
      <Check disabled>Disabled</Check>
      <Check kind="radio" name="unit" defaultChecked>
        Points
      </Check>
      <Check kind="radio" name="unit">
        Stories
      </Check>
    </div>
  )
};

export const Focus: Story = {
  render: () => <TextInput aria-label="Title" defaultValue="Login page" />,
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByLabelText('Title'));
  }
};
