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
    });
  });

  it('falls back to a bundled theme for an unknown theme name', () => {
    expect(resolveThemeBaseTokens('not-a-real-theme')).toEqual(
      resolveThemeBaseTokens('classic'),
    );
  });
});
