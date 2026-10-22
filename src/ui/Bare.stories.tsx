import type { Meta, StoryObj } from '@storybook/react-vite';
import { userEvent } from 'storybook/test';
import { BareButton } from './BareButton';
import { BareInput } from './BareInput';
import { CheckInput } from './CheckInput';
import { DragHandle } from './DragHandle';

const meta: Meta = { title: 'Components/Bare elements' };
export default meta;
type Story = StoryObj;

/** The grip of rows and cards; it needs an accessible name. */
export const DragHandles: Story = {
  render: () => (
    <div className="catalogue-row">
      <DragHandle aria-label="Move Login page" />
      <DragHandle aria-label="Move Sort cards" disabled />
    </div>
  )
};

export const DragHandleFocus: Story = {
  render: () => <DragHandle aria-label="Move Login page" />,
  play: async () => {
    await userEvent.tab();
  }
};

/** Checkboxes and radio buttons in a table or row, where the name comes from `aria-label`. */
export const CheckInputs: Story = {
  render: () => (
    <div className="catalogue-row">
      <CheckInput aria-label="Used" defaultChecked />
      <CheckInput aria-label="Not used" />
      <CheckInput aria-label="Locked" disabled defaultChecked />
      <CheckInput kind="radio" name="rule" aria-label="Local wins" defaultChecked />
      <CheckInput kind="radio" name="rule" aria-label="GitHub wins" />
    </div>
  )
};

/** Feature-specific buttons and fields have no look of their own: the feature gives them a class built from tokens. */
export const BareElements: Story = {
  render: () => (
    <div className="catalogue-row">
      <BareButton type="button" className="member-filter__chip" aria-pressed="true">
        All
      </BareButton>
      <BareButton type="button" className="member-filter__chip" aria-pressed="false">
        Mia
      </BareButton>
      <BareInput className="input" aria-label="Search" defaultValue="login" />
    </div>
  )
};
