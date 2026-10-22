// @vitest-environment node
// The design system is mandatory for every feature (#70): the rule is written down where the work is done.
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const root = resolve(__dirname, '../..');
const read = (path: string) => readFileSync(join(root, path), 'utf8');

describe('design system adherence is mandatory', () => {
  test('AC5.1 CLAUDE.md, the Definition of Done and the working mode require the design system', () => {
    // Given the rules of the working mode
    const claude = read('CLAUDE.md');
    const done = read('docs/definition-of-done.md');
    const workingMode = read('docs/working-mode.md');
    // Then each says that using the design system is mandatory and that missing parts are added in the same pull request
    expect(claude).toMatch(/design system is mandatory/i);
    expect(claude).toMatch(/extend the design system in the same pull request/i);
    expect(done).toMatch(/Design system adherence/);
    expect(workingMode).toMatch(/mandatory for every feature/i);
    expect(workingMode).toMatch(/same pull request/i);
    // And the skills for building and for design proposals know it
    expect(read('.claude/skills/go/SKILL.md')).toMatch(/design system/i);
    expect(read('.claude/skills/design-vorschlag/SKILL.md')).toMatch(/design system/i);
  });

  test('AC5.2 the pull request template has the entry "Design system adherence" with the link to the catalogue', () => {
    // Given the pull request template
    const template = read('.github/pull_request_template.md');
    // Then it has a checklist entry for the design system and the address of the catalogue
    expect(template).toMatch(/## Design system adherence/);
    expect(template).toMatch(/- \[ \] Only tokens/);
    expect(template).toMatch(/\/design-system\//);
  });

  test('AC2.2 npm run build also builds the catalogue next to the web app, the desktop app does not', () => {
    // Given the scripts of the project and the desktop configuration
    const scripts = JSON.parse(read('package.json')).scripts as Record<string, string>;
    const tauri = JSON.parse(read('src-tauri/tauri.conf.json')) as { build: { beforeBuildCommand: string } };
    // Then the web build puts the catalogue into dist/design-system
    expect(scripts.build).toContain('storybook build -o dist/design-system');
    // And the desktop app is built without it
    expect(tauri.build.beforeBuildCommand).toBe('npm run build:app');
    expect(scripts['build:app']).not.toContain('storybook');
  });

  test('AC6.2 the README and the design system page link the public catalogue', () => {
    // Given the README and the design system page
    // Then both name the address of the catalogue on GitHub Pages
    for (const file of ['README.md', 'docs/design-system.md']) expect(read(file)).toContain('https://goerks.github.io/GetThingsDone/');
  });

  test('AC6.1 the catalogue is published on GitHub Pages after every change of main', () => {
    // Given the workflow of the catalogue
    const workflow = read('.github/workflows/pages.yml');
    // Then it runs on every push to main, builds the catalogue and deploys it with GitHub Pages
    expect(workflow).toMatch(/push:\s*\n\s*branches: \[main\]/);
    expect(workflow).toContain('npm run build-storybook');
    expect(workflow).toContain('path: dist/design-system');
    expect(workflow).toContain('actions/deploy-pages');
  });

  test('AC6.3 the catalogue is built again from main on every push, so a merged change shows up', () => {
    // Given the workflow of the catalogue
    const workflow = read('.github/workflows/pages.yml');
    // Then it installs from the lock file, builds the current state and replaces an older deployment that is still running
    expect(workflow).toContain('npm ci');
    expect(workflow).toMatch(/cancel-in-progress: true/);
    expect(workflow).toContain('workflow_dispatch');
  });
});
