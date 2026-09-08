import { describe, expect, it } from 'vitest';
import { resolveThemeBaseTokens } from './resolve-theme-base-tokens';

// Real values from themes/classic/theme.css and themes/docs-showcase/theme.css.

describe('resolveThemeBaseTokens', () => {
  it("resolves classic's own base tokens", () => {
    expect(resolveThemeBaseTokens('classic')).toEqual({
      primary: 'oklch(0.205 0 0)',
      secondary: 'oklch(0.97 0 0)',
      // classic ships no font of its own — it declared 'Inter Variable'
      // without anything ever loading it, so it always rendered with this
      // fallback anyway.
      fontSansValue: 'ui-sans-serif, system-ui, sans-serif',
      radius: '0.5rem',
      // The rest of the colour vocabulary, for the picker's theme
      // swatches (ADR-0050) — read from the same `:root` as the four
      // above, so a theme that renames one loses a swatch here rather
      // than silently offering a colour that resolves to nothing.
      background: 'oklch(1 0 0)',
      foreground: 'oklch(0.145 0 0)',
      muted: 'oklch(0.97 0 0)',
      mutedForeground: 'oklch(0.556 0 0)',
      border: 'oklch(0.922 0 0)',
      link: 'var(--primary)',
    });
  });

  it("resolves docs-showcase's own, different base tokens", () => {
    expect(resolveThemeBaseTokens('docs-showcase')).toEqual({
      primary: '#5b9bd5',
      secondary: '#151b23',
      // Must match the @font-face name fonts.css pulls in exactly —
      // @fontsource-variable/sora declares 'Sora Variable'.
      fontSansValue: "'Sora Variable', ui-sans-serif, system-ui, sans-serif",
      radius: '1rem',
      background: '#0b0f14',
      foreground: '#f3f5f7',
      muted: '#1b222b',
      mutedForeground: '#94a3b8',
      border: '#263140',
      // This theme declares no `--link` of its own, so there is nothing
      // to resolve — the picker drops that swatch rather than offering a
      // colour that resolves to nothing. Not a gap to fill: it is the
      // absent case, and it is real.
      link: undefined,
    });
  });

  it('falls back to a bundled theme for an unknown theme name', () => {
    expect(resolveThemeBaseTokens('not-a-real-theme')).toEqual(
      resolveThemeBaseTokens('classic'),
    );
  });
});
