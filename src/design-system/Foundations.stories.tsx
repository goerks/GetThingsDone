import { useEffect, useState, type ReactNode } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { COLOR_GROUPS, tokensWithPrefix } from './tokens';
import * as icons from '../components/icons';

const meta: Meta = { title: 'Foundations', parameters: { layout: 'padded' } };
export default meta;
type Story = StoryObj;

/** The computed value of a token in the theme that is showing, so the swatches follow the theme switch. */
function useTokenValue(name: string): string {
  const read = () => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  const [value, setValue] = useState(read);
  useEffect(() => {
    setValue(read());
    const observer = new MutationObserver(() => setValue(read()));
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name]);
  return value;
}

function Section({ title, use, children }: { title: string; use: string; children: ReactNode }) {
  return (
    <section className="catalogue-section">
      <h2>{title}</h2>
      <p>{use}</p>
      {children}
    </section>
  );
}

function Swatch({ name }: { name: string }) {
  const value = useTokenValue(name);
  return (
    <div className="catalogue-swatch">
      <div className="catalogue-swatch__chip" style={{ background: `var(${name})` }} />
      <div className="catalogue-swatch__meta">
        <span className="catalogue-name">{name}</span>
        <span className="catalogue-value">{value}</span>
      </div>
    </div>
  );
}

export const Colors: Story = {
  render: () => (
    <>
      {COLOR_GROUPS.map((group) => (
        <Section key={group.title} title={group.title} use={group.use}>
          <div className="catalogue-grid">
            {group.names.map((name) => (
              <Swatch key={name} name={name} />
            ))}
          </div>
        </Section>
      ))}
    </>
  )
};

export const Typography: Story = {
  render: () => (
    <>
      <Section title="Font families" use="IBM Plex Sans for text, IBM Plex Mono for IDs and values.">
        <div className="catalogue-row">
          <span style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--font-size-3xl)' }}>Sans: Get it done</span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--font-size-3xl)' }}>Mono: S-3</span>
        </div>
      </Section>
      <Section title="Size scale" use="The only font sizes of the product. Body text is --font-size-lg.">
        <table className="catalogue-table">
          <thead>
            <tr>
              <th>Token</th>
              <th>Value</th>
              <th>Example</th>
            </tr>
          </thead>
          <tbody>
            {tokensWithPrefix('--font-size-').map((token) => (
              <tr key={token.name}>
                <td className="catalogue-name">{token.name}</td>
                <td className="catalogue-value">{token.value}</td>
                <td style={{ fontSize: `var(${token.name})` }}>Login page for the team</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>
      <Section title="Weights and line heights" use="Regular for text, medium for labels, semibold for headings and buttons, bold for emphasis.">
        <table className="catalogue-table">
          <tbody>
            {tokensWithPrefix('--weight-').map((token) => (
              <tr key={token.name}>
                <td className="catalogue-name">{token.name}</td>
                <td className="catalogue-value">{token.value}</td>
                <td style={{ fontWeight: `var(${token.name})` as unknown as number }}>Story points</td>
              </tr>
            ))}
            {tokensWithPrefix('--leading-').map((token) => (
              <tr key={token.name}>
                <td className="catalogue-name">{token.name}</td>
                <td className="catalogue-value">{token.value}</td>
                <td>Line height of a paragraph</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>
    </>
  )
};

export const Spacing: Story = {
  render: () => (
    <Section title="Spacing" use="A 4 px grid with half steps. Gaps, padding and margins use these tokens only.">
      <table className="catalogue-table">
        <tbody>
          {tokensWithPrefix('--space-').map((token) => (
            <tr key={token.name}>
              <td className="catalogue-name">{token.name}</td>
              <td className="catalogue-value">{token.value}</td>
              <td>
                <div className="catalogue-bar" style={{ width: `var(${token.name})` }} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Section>
  )
};

export const Radius: Story = {
  render: () => (
    <Section title="Radius" use="Small details, inputs and buttons, cards, large surfaces, pills and dots.">
      <div className="catalogue-row">
        {tokensWithPrefix('--radius-').map((token) => (
          <div key={token.name} style={{ display: 'grid', gap: 'var(--space-1)', justifyItems: 'center' }}>
            <div className="catalogue-box" style={{ borderRadius: `var(${token.name})` }} />
            <span className="catalogue-name">{token.name}</span>
            <span className="catalogue-value">{token.value}</span>
          </div>
        ))}
      </div>
    </Section>
  )
};

export const Elevation: Story = {
  render: () => (
    <Section title="Elevation" use="1: cards. 2: lifted or dragged things. 3: menus and popovers. 4: dialogs and toasts. Panel: side panel.">
      <div className="catalogue-row" style={{ padding: 'var(--space-6)', background: 'var(--bg)' }}>
        {tokensWithPrefix('--elevation-').map((token) => (
          <div key={token.name} style={{ display: 'grid', gap: 'var(--space-1)', justifyItems: 'center' }}>
            <div className="catalogue-card" style={{ boxShadow: `var(${token.name})` }}>
              {token.name.replace('--elevation-', '')}
            </div>
            <span className="catalogue-name">{token.name}</span>
          </div>
        ))}
      </div>
    </Section>
  )
};

export const Layers: Story = {
  render: () => (
    <Section title="Layers" use="Stacking order. The local layers 1 to 5 only order things inside one component.">
      <table className="catalogue-table">
        <tbody>
          {tokensWithPrefix('--z-').map((token) => (
            <tr key={token.name}>
              <td className="catalogue-name">{token.name}</td>
              <td className="catalogue-value">{token.value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Section>
  )
};

export const Motion: Story = {
  render: () => (
    <Section title="Motion" use="Short transitions for hover and focus (fast), slower ones for progress. Everything stops with reduced motion.">
      <table className="catalogue-table">
        <tbody>
          {tokensWithPrefix('--duration-', '--ease').map((token) => (
            <tr key={token.name}>
              <td className="catalogue-name">{token.name}</td>
              <td className="catalogue-value">{token.value}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p>Hover the track to see the slow duration.</p>
      <div className="catalogue-motion-track">
        <div className="catalogue-motion" />
      </div>
    </Section>
  )
};

export const Icons: Story = {
  render: () => (
    <Section title="Icons" use="Inline SVG in currentColor, 14, 16 or 18 px (--icon-sm, --icon-md, --icon-lg). Always decorative: the button or the text beside it carries the name.">
      <div className="catalogue-grid">
        {Object.entries(icons).map(([name, Icon]) => (
          <div key={name} className="catalogue-swatch">
            <div className="catalogue-swatch__chip" style={{ display: 'grid', placeItems: 'center' }}>
              <Icon />
            </div>
            <div className="catalogue-swatch__meta">
              <span className="catalogue-name">{name}</span>
            </div>
          </div>
        ))}
      </div>
    </Section>
  )
};

export const Accessibility: Story = {
  render: () => (
    <Section title="Accessibility rules" use="Every component meets these rules in both themes (ADR 0002, QR-03, QR-04).">
      <div style={{ display: 'grid', gap: 'var(--space-3)' }}>
        {[
          ['Contrast', 'Body text at least 4.5:1, epic colours at least 3:1 against cards and columns.'],
          ['Target size', 'Interactive targets are at least 44 by 44 px (--target-min).'],
          ['Focus', 'Every interactive element shows the focus ring (2 px accent, 2 px offset).'],
          ['Colour is never alone', 'A status or epic colour always comes with a text or an icon.'],
          ['Keyboard', 'Everything works with the keyboard alone; dialogs trap focus and close with Escape.'],
          ['Languages', 'No hard-coded user-facing text: DE, EN, FR and IT.']
        ].map(([title, text]) => (
          <div key={title} className="catalogue-rule">
            <strong>{title}</strong>
            <span>{text}</span>
          </div>
        ))}
      </div>
    </Section>
  )
};
