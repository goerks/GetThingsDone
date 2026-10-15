// @vitest-environment node
// Keeps the PO commands (#41, #43) consistent: every skill in .claude/skills
// has valid front matter and appears in /hilfe, CLAUDE.md and docs/working-mode.md.
import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const root = resolve(__dirname, '../..');
const skillsDir = join(root, '.claude/skills');
const read = (path: string) => readFileSync(join(root, path), 'utf8');

const skills = readdirSync(skillsDir, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort();

function frontMatter(skill: string): Record<string, string> {
  const text = readFileSync(join(skillsDir, skill, 'SKILL.md'), 'utf8');
  const match = /^---\n([\s\S]*?)\n---\n/.exec(text);
  if (!match) return {};
  return Object.fromEntries(
    match[1].split('\n').map((line) => {
      const colon = line.indexOf(':');
      return [line.slice(0, colon).trim(), line.slice(colon + 1).trim()];
    })
  );
}

describe('PO commands', () => {
  test('there are skills', () => {
    expect(skills).toContain('start');
    expect(skills).toContain('hilfe');
  });

  test.each(skills)('/%s has a name and a complete description', (skill) => {
    // Given the front matter of the skill
    const fields = frontMatter(skill);
    // Then the name matches the folder
    expect(fields.name).toBe(skill);
    // And the description is not cut off: "#" starts a YAML comment unless the value is quoted
    const description = fields.description ?? '';
    expect(description.length).toBeGreaterThan(20);
    if (description.includes('#')) {
      expect(description.startsWith('"') && description.endsWith('"')).toBe(true);
    }
  });

  test('no command uses the name of a built-in Claude Code command', () => {
    // Built-in commands take precedence over skills, so a skill with such a name never runs
    const builtIn = [
      'help', 'status', 'feedback', 'bug', 'clear', 'compact', 'config', 'cost', 'doctor', 'init',
      'login', 'logout', 'memory', 'model', 'review', 'resume', 'agents', 'mcp', 'permissions',
      'hooks', 'context', 'export', 'exit', 'add-dir', 'release-notes', 'rewind', 'usage', 'plugin'
    ];
    expect(skills.filter((skill) => builtIn.includes(skill))).toEqual([]);
  });

  test('/hilfe lists exactly the existing commands', () => {
    // Given the overview of /hilfe
    const help = read('.claude/skills/hilfe/SKILL.md');
    // When we collect the commands in its table
    const listed = [...help.matchAll(/^\| `\/([a-z-]+)/gm)].map((m) => m[1]).sort();
    // Then they are the skills, no more and no less
    expect(listed).toEqual(skills);
  });

  test.each(skills)('/%s is described in CLAUDE.md and in the working mode with its diagram', (skill) => {
    const claude = read('CLAUDE.md');
    const workingMode = read('docs/working-mode.md');
    const diagram = /```mermaid\n([\s\S]*?)```/.exec(workingMode)?.[1] ?? '';
    expect(claude).toContain(`\`/${skill}\``);
    expect(workingMode).toContain(`| \`/${skill}`);
    expect(diagram).toContain(`/${skill}`);
  });
});
