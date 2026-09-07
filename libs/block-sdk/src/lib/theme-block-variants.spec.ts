import { describe, expect, it } from 'vitest';
import {
  checkVariantsAgainstCore,
  collectThemeVariantExtensions,
  validateThemeVariantExtensions,
  type ThemeBlockVariant,
} from './theme-block-variants';

const LOCALES = ['en', 'it'];
const ghost: ThemeBlockVariant = {
  value: 'ghost',
  label: { en: 'Ghost', it: 'Fantasma' },
};

describe('collectThemeVariantExtensions', () => {
  it('reads the block type from the file name', () => {
    expect(
      collectThemeVariantExtensions({
        '../../themes/acme/blocks/Button.variants.ts': { default: [ghost] },
      }),
    ).toEqual([{ blockType: 'Button', variants: [ghost] }]);
  });
});

describe('validateThemeVariantExtensions', () => {
  it('accepts a well-formed extension', () => {
    expect(
      validateThemeVariantExtensions(
        [{ blockType: 'Button', variants: [ghost] }],
        LOCALES,
      ),
    ).toEqual([]);
  });

  // The value becomes a CSS class, so it goes through the same character
  // rule as everything else that reaches a selector (PR #144).
  it.each([
    'Ghost',
    'ghost button',
    '--ghost',
    'ghost; } body { display: none } .x {',
    '',
  ])('refuses %s as a variant name', (value) => {
    const errors = validateThemeVariantExtensions(
      [
        {
          blockType: 'Button',
          variants: [{ value, label: { en: 'x', it: 'x' } }],
        },
      ],
      LOCALES,
    );
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toContain('CSS class');
  });

  it("refuses the reserved name for the type's own look", () => {
    const errors = validateThemeVariantExtensions(
      [
        {
          blockType: 'Button',
          variants: [{ value: 'default', label: { en: 'x', it: 'x' } }],
        },
      ],
      LOCALES,
    );
    expect(errors[0].message).toContain('reserved');
  });

  /**
   * A label missing in one language is the kind of thing that ships: the
   * author works in their own locale, sees it fill in, and never opens
   * the other one. The editor would show a raw i18n key to the client.
   */
  it('refuses a variant with no label in one of the locales', () => {
    const errors = validateThemeVariantExtensions(
      [
        {
          blockType: 'Button',
          variants: [{ value: 'ghost', label: { en: 'Ghost' } }],
        },
      ],
      LOCALES,
    );
    expect(errors[0].message).toContain('no label for it');
  });

  it('refuses the same variant declared twice', () => {
    const errors = validateThemeVariantExtensions(
      [{ blockType: 'Button', variants: [ghost, ghost] }],
      LOCALES,
    );
    expect(errors[0].message).toContain('declared twice');
  });

  it('refuses a file that exports nothing usable', () => {
    expect(
      validateThemeVariantExtensions(
        [{ blockType: 'Button', variants: [] }],
        LOCALES,
      )[0].message,
    ).toContain('non-empty array');
  });
});

describe('checkVariantsAgainstCore', () => {
  const core = { Button: ['secondary'] };
  const types = ['Button', 'Hero'];

  it('accepts a look the core block does not have', () => {
    expect(
      checkVariantsAgainstCore(
        [{ blockType: 'Button', variants: [ghost] }],
        core,
        types,
      ),
    ).toEqual([]);
  });

  // Almost always a typo in the file name, and one that would otherwise
  // sit there declaring looks nobody can pick, with nothing failing.
  it('refuses extending a type that does not exist', () => {
    const errors = checkVariantsAgainstCore(
      [{ blockType: 'Buttton', variants: [ghost] }],
      core,
      types,
    );
    expect(errors[0].message).toContain('not a core block type');
  });

  it("refuses redeclaring one of the block's own looks", () => {
    const errors = checkVariantsAgainstCore(
      [
        {
          blockType: 'Button',
          variants: [{ value: 'secondary', label: { en: 'S', it: 'S' } }],
        },
      ],
      core,
      types,
    );
    expect(errors[0].message).toContain('already one of this block');
  });
});
