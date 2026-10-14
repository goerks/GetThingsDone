import { beforeAll, describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';
import { LocalStorageRepository } from './data/localStorageRepository';
import { seedSnapshot } from './data/seed';
import { initI18n } from './i18n';
import { todayIso } from './domain/sprints';

beforeAll(() => {
  initI18n('en');
});

describe('quick add (#32)', () => {
  it('AC5.6 opens the full dialog with the title when a required field has no default', async () => {
    // Given a required field without a default value for stories
    const repository = new LocalStorageRepository();
    const snapshot = seedSnapshot(todayIso());
    await repository.replaceAll({
      ...snapshot,
      assignments: snapshot.assignments.map((item) => (item.fieldId === 'field-demo-value' && item.itemType === 'story' ? { ...item, required: true } : item))
    });
    window.location.hash = '#/board';
    render(<App repository={repository} />);
    const user = userEvent.setup();

    // When I add a story from the board with "+ Story" and a title
    const toDo = await screen.findByRole('region', { name: /^To do/ });
    await user.click(within(toDo).getByRole('button', { name: '+ Story in To do' }));
    await user.type(within(toDo).getByRole('textbox', { name: 'Title of the new story in To do' }), 'Needs a value{Enter}');

    // Then "New story" opens with the title filled in and marks the missing required field
    const dialog = await screen.findByRole('dialog', { name: 'New story' });
    expect(within(dialog).getByLabelText('Title')).toHaveValue('Needs a value');
    expect(within(dialog).getByRole('alert')).toHaveTextContent('Please fill in: Business value');
    // And no story was created yet
    expect((await repository.load()).stories.find((story) => story.title === 'Needs a value')).toBeUndefined();
  });
});
