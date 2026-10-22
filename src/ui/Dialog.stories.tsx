import type { Meta, StoryObj } from '@storybook/react-vite';
import { Dialog } from '../components/Dialog';
import { DialogFooter } from '../components/DialogFooter';
import { TextInput } from './TextInput';

const meta: Meta<typeof Dialog> = {
  title: 'Components/Dialog',
  component: Dialog,
  parameters: { layout: 'fullscreen' },
  args: { onClose: () => undefined }
};
export default meta;
type Story = StoryObj<typeof Dialog>;

/** The create dialog: title, fields and the footer with "Cancel" and the primary button at the right. */
export const Create: Story = {
  render: (args) => (
    <Dialog {...args} title="New story">
      <form className="form" onSubmit={(event) => event.preventDefault()}>
        <label className="field">
          <span className="field__label">Title</span>
          <TextInput defaultValue="Login page" />
        </label>
        <DialogFooter submit="Create" onCancel={() => undefined} />
      </form>
    </Dialog>
  )
};
