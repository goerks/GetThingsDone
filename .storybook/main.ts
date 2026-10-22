import type { StorybookConfig } from '@storybook/react-vite';

// The design system catalogue (#70). It is built from the real components and tokens.
const config: StorybookConfig = {
  stories: ['../src/**/*.mdx', '../src/**/*.stories.@(ts|tsx)'],
  addons: ['@storybook/addon-a11y', '@storybook/addon-docs'],
  framework: '@storybook/react-vite',
  core: { disableTelemetry: true }
};

export default config;
