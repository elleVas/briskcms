import { describe, expect, it } from 'vitest';
import { checkContrastAgainstThemeForeground } from './color-contrast';

describe('checkContrastAgainstThemeForeground', () => {
  it('gives the well-known 21:1 ratio for pure white vs pure black', () => {
    const result = checkContrastAgainstThemeForeground('#ffffff', '#000000');

    expect(result?.ratio).toBeCloseTo(21, 1);
    expect(result?.passesAA).toBe(true);
  });

  it('gives a 1:1 ratio for a color against itself', () => {
    const result = checkContrastAgainstThemeForeground('#3366cc', '#3366cc');

    expect(result?.ratio).toBeCloseTo(1, 5);
    expect(result?.passesAA).toBe(false);
  });

  it('is case-insensitive for hex input', () => {
    const result = checkContrastAgainstThemeForeground('#FFFFFF', '#000000');

    expect(result?.ratio).toBeCloseTo(21, 1);
  });

  it('parses an oklch(...) foreground token (the format the active theme actually uses)', () => {
    // themes/classic/theme.css: --primary-foreground: oklch(0.985 0 0),
    // a near-white achromatic color — should read almost like pure white.
    const result = checkContrastAgainstThemeForeground(
      '#000000',
      'oklch(0.985 0 0)',
    );

    expect(result?.ratio).toBeGreaterThan(19);
    expect(result?.passesAA).toBe(true);
  });

  it('flags a light background against a near-white theme foreground as failing AA', () => {
    // A real risk this check exists for: a light/pastel primaryColor
    // picked by a site owner, paired with the theme's fixed near-white
    // --primary-foreground (oklch(0.985 0 0)) — both light, unreadable.
    const result = checkContrastAgainstThemeForeground(
      '#fffacd',
      'oklch(0.985 0 0)',
    );

    expect(result?.passesAA).toBe(false);
    expect(result?.ratio).toBeLessThan(4.5);
  });

  it('flags a dark-but-not-dark-enough background against a near-black theme foreground', () => {
    // Mirrors the case above for the other extreme: --secondary-foreground
    // (oklch(0.205 0 0), near-black) paired with a background that's dark
    // but still too close in luminance to read clearly.
    const result = checkContrastAgainstThemeForeground(
      '#4d4d4d',
      'oklch(0.205 0 0)',
    );

    expect(result?.passesAA).toBe(false);
    expect(result?.ratio).toBeLessThan(4.5);
  });

  it('passes for a properly dark background against a near-white theme foreground', () => {
    const result = checkContrastAgainstThemeForeground(
      '#1a1a2e',
      'oklch(0.985 0 0)',
    );

    expect(result?.passesAA).toBe(true);
  });

  it('returns null for an unrecognized background color format', () => {
    expect(
      checkContrastAgainstThemeForeground('red', 'oklch(0.985 0 0)'),
    ).toBeNull();
  });

  it('returns null for an unrecognized (unresolved) foreground token', () => {
    expect(
      checkContrastAgainstThemeForeground(
        '#ffffff',
        'var(--primary-foreground)',
      ),
    ).toBeNull();
  });
});
