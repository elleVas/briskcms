import { describe, expect, it } from 'vitest';
import type { BlockDescriptor } from './field-types';
import {
  validateThemeBlockSet,
  type ThemeBlockCandidate,
} from './validate-theme-blocks';

function validDescriptor(
  overrides: Partial<BlockDescriptor> = {},
): BlockDescriptor {
  return {
    type: 'Faq',
    label: 'blocks.faq.label',
    category: 'content',
    defaultProps: { question: '', answer: '' },
    fields: [
      {
        kind: 'text',
        key: 'question',
        label: 'blocks.faq.fields.question.fieldLabel',
      },
      {
        kind: 'select',
        key: 'tone',
        label: 'blocks.faq.fields.tone.fieldLabel',
        options: [
          { label: 'blocks.faq.fields.tone.options.info', value: 'info' },
        ],
      },
    ],
    ...overrides,
  };
}

function validCandidate(
  overrides: Partial<ThemeBlockCandidate> = {},
): ThemeBlockCandidate {
  return {
    basename: 'Faq',
    descriptor: validDescriptor(),
    hasRenderComponent: true,
    locales: {
      en: {
        label: 'FAQ',
        fields: {
          question: { fieldLabel: 'Question' },
          tone: { fieldLabel: 'Tone', options: { info: 'Info' } },
        },
      },
      it: {
        label: 'FAQ',
        fields: {
          question: { fieldLabel: 'Domanda' },
          tone: { fieldLabel: 'Tono', options: { info: 'Info' } },
        },
      },
    },
    ...overrides,
  };
}

describe('validateThemeBlockSet', () => {
  it('accepts a fully well-formed candidate', () => {
    expect(validateThemeBlockSet([validCandidate()])).toEqual([]);
  });

  it('rejects a filename that does not match the descriptor type', () => {
    const errors = validateThemeBlockSet([
      validCandidate({ basename: 'Wrong' }),
    ]);
    expect(errors).toContainEqual(
      expect.objectContaining({
        basename: 'Wrong',
        message: expect.stringContaining('must match its own type'),
      }),
    );
  });

  it('rejects a block with no matching .astro render component', () => {
    const errors = validateThemeBlockSet([
      validCandidate({ hasRenderComponent: false }),
    ]);
    expect(errors).toContainEqual(
      expect.objectContaining({
        message: expect.stringContaining('no matching "Faq.astro"'),
      }),
    );
  });

  it('rejects an unknown category slug', () => {
    const errors = validateThemeBlockSet([
      validCandidate({
        descriptor: validDescriptor({ category: 'hero-section' }),
      }),
    ]);
    expect(errors).toContainEqual(
      expect.objectContaining({
        message: expect.stringContaining('is not one of'),
      }),
    );
  });

  it('rejects a field with kind:"custom"', () => {
    const errors = validateThemeBlockSet([
      validCandidate({
        descriptor: validDescriptor({
          fields: [
            {
              kind: 'custom',
              key: 'picker',
              label: 'blocks.faq.fields.picker.fieldLabel',
              component: () => null,
            },
          ],
        }),
      }),
    ]);
    expect(errors).toContainEqual(
      expect.objectContaining({
        message: expect.stringContaining("kind:'custom'"),
      }),
    );
  });

  it('rejects a descriptor label that does not match the derived i18n key — the exact Heading-style regression, one layer earlier', () => {
    const errors = validateThemeBlockSet([
      validCandidate({
        descriptor: validDescriptor({ label: 'blocks.faq.lable' }),
      }),
    ]);
    expect(errors).toContainEqual(
      expect.objectContaining({
        message: 'label "blocks.faq.lable" must be exactly "blocks.faq.label"',
      }),
    );
  });

  it('rejects a field label that does not match the derived i18n key', () => {
    const errors = validateThemeBlockSet([
      validCandidate({
        descriptor: validDescriptor({
          fields: [
            {
              kind: 'text',
              key: 'question',
              label: 'blocks.faq.fields.question.wrong',
            },
          ],
        }),
      }),
    ]);
    expect(errors).toContainEqual(
      expect.objectContaining({
        message: expect.stringContaining(
          'field "question" label "blocks.faq.fields.question.wrong" must be exactly',
        ),
      }),
    );
  });

  it('rejects an option label that does not match the derived i18n key', () => {
    const errors = validateThemeBlockSet([
      validCandidate({
        descriptor: validDescriptor({
          fields: [
            {
              kind: 'select',
              key: 'tone',
              label: 'blocks.faq.fields.tone.fieldLabel',
              options: [
                {
                  label: 'blocks.faq.fields.tone.options.wrong',
                  value: 'info',
                },
              ],
            },
          ],
        }),
      }),
    ]);
    expect(errors).toContainEqual(
      expect.objectContaining({
        message: expect.stringContaining(
          'option "info" label "blocks.faq.fields.tone.options.wrong" must be exactly',
        ),
      }),
    );
  });

  it('derives the expected key from the type with only the first character lowercased, matching multi-word core block keys (e.g. EmbedHtml -> blocks.embedHtml)', () => {
    const errors = validateThemeBlockSet([
      validCandidate({
        basename: 'StatusBadge',
        descriptor: validDescriptor({
          type: 'StatusBadge',
          label: 'blocks.statusbadge.label',
        }),
      }),
    ]);
    expect(errors).toContainEqual(
      expect.objectContaining({
        message:
          'label "blocks.statusbadge.label" must be exactly "blocks.statusBadge.label"',
      }),
    );
  });

  it('rejects a missing locales.json', () => {
    const errors = validateThemeBlockSet([
      validCandidate({ locales: undefined }),
    ]);
    expect(errors).toContainEqual(
      expect.objectContaining({
        message: expect.stringContaining('no matching "Faq.locales.json"'),
      }),
    );
  });

  it('rejects a locales.json missing one locale entirely', () => {
    const errors = validateThemeBlockSet([
      validCandidate({ locales: { en: validCandidate().locales?.en } }),
    ]);
    expect(errors).toContainEqual(
      expect.objectContaining({
        message: 'locales.json is missing "it"',
      }),
    );
  });

  it('rejects a locales.json missing a field label — the exact Heading-style regression this exists to catch', () => {
    const errors = validateThemeBlockSet([
      validCandidate({
        locales: {
          en: { label: 'FAQ', fields: {} },
          it: { label: 'FAQ', fields: {} },
        },
      }),
    ]);
    expect(errors).toContainEqual(
      expect.objectContaining({
        message: expect.stringContaining('fields.question.fieldLabel'),
      }),
    );
  });

  it('rejects a locales.json missing a select option label', () => {
    const errors = validateThemeBlockSet([
      validCandidate({
        locales: {
          en: {
            label: 'FAQ',
            fields: {
              question: { fieldLabel: 'Q' },
              tone: { fieldLabel: 'Tone' },
            },
          },
          it: validCandidate().locales?.it,
        },
      }),
    ]);
    expect(errors).toContainEqual(
      expect.objectContaining({
        message: expect.stringContaining('fields.tone.options.info'),
      }),
    );
  });

  it('rejects stylableProperties that do not exactly match defaultStyle keys', () => {
    const errors = validateThemeBlockSet([
      validCandidate({
        descriptor: validDescriptor({
          stylableProperties: ['backgroundColor', 'textColor'],
          defaultStyle: { backgroundColor: 'var(--background)' },
        }),
      }),
    ]);
    expect(errors).toContainEqual(
      expect.objectContaining({
        message: expect.stringContaining('does not match defaultStyle keys'),
      }),
    );
  });

  it('accepts matching stylableProperties and defaultStyle', () => {
    const errors = validateThemeBlockSet([
      validCandidate({
        descriptor: validDescriptor({
          stylableProperties: ['backgroundColor', 'textColor'],
          defaultStyle: {
            backgroundColor: 'var(--background)',
            textColor: 'inherit',
          },
        }),
      }),
    ]);
    expect(errors).toEqual([]);
  });
});
