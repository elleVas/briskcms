import { describe, expect, it } from 'vitest';
import { resolveThemeForegroundTokens } from './resolve-theme-foreground-tokens';

// Real values from themes/classic/theme.css and themes/docs-showcase/theme.css.

describe('resolveThemeForegroundTokens', () => {
  it("resolves classic's own foreground tokens", () => {
    expect(resolveThemeForegroundTokens('classic')).toEqual({
      primaryForeground: 'oklch(0.985 0 0)',
      secondaryForeground: 'oklch(0.205 0 0)',
    });
  });

  it("resolves docs-showcase's own, different foreground tokens", () => {
    expect(resolveThemeForegroundTokens('docs-showcase')).toEqual({
      primaryForeground: '#0b0f14',
      secondaryForeground: '#e4e7eb',
    });
  });

  it('falls back to a bundled theme for an unknown theme name', () => {
    expect(resolveThemeForegroundTokens('not-a-real-theme')).toEqual(
      resolveThemeForegroundTokens('classic'),
    );
  });
});
