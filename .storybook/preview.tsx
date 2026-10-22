import type { Preview } from '@storybook/react-vite';
import '@fontsource/ibm-plex-sans/400.css';
import '@fontsource/ibm-plex-sans/500.css';
import '@fontsource/ibm-plex-sans/600.css';
import '@fontsource/ibm-plex-mono/400.css';
import '../docs/design/tokens.css';
import '../src/styles/app.css';
import '../src/design-system/catalogue.css';
import { initI18n } from '../src/i18n';

initI18n();

const preview: Preview = {
  globalTypes: {
    theme: {
      description: 'Theme',
      toolbar: { title: 'Theme', icon: 'mirror', dynamicTitle: true, items: [{ value: 'light', title: 'Light' }, { value: 'dark', title: 'Dark' }] }
    }
  },
  initialGlobals: { theme: 'light' },
  decorators: [
    (Story, context) => {
      document.documentElement.dataset.theme = context.globals.theme === 'dark' ? 'dark' : 'light';
      return (
        <div className="catalogue-canvas">
          <Story />
        </div>
      );
    }
  ],
  parameters: {
    layout: 'padded',
    a11y: { test: 'todo' },
    controls: { matchers: { color: /(background|color)$/i } }
  }
};

export default preview;
