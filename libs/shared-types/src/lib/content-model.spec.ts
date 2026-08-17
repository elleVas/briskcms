import { describe, expect, it } from 'vitest';
import {
  blockSchema,
  pageContentSchema,
  seoMetaSchema,
} from './content-model.js';

describe('content-model schemas', () => {
  it('accepts a valid block', () => {
    const result = blockSchema.safeParse({
      type: 'Hero',
      props: { title: 'Brisk' },
    });
    expect(result.success).toBe(true);
  });

  it('rejects a block without a type', () => {
    const result = blockSchema.safeParse({ props: {} });
    expect(result.success).toBe(false);
  });

  it('validates a page content array', () => {
    const result = pageContentSchema.safeParse([
      { type: 'Hero', props: { title: 'Brisk' } },
      { type: 'Text', props: { body: 'ciao' } },
    ]);
    expect(result.success).toBe(true);
  });

  it('accepts nested children on a block', () => {
    const result = blockSchema.safeParse({
      type: 'Columns',
      props: {},
      children: [
        { type: 'Text', props: { body: 'colonna 1' } },
        {
          type: 'Columns',
          props: {},
          children: [{ type: 'Text', props: { body: 'annidato due livelli' } }],
        },
      ],
    });
    expect(result.success).toBe(true);
  });

  it('rejects a malformed nested child', () => {
    const result = blockSchema.safeParse({
      type: 'Columns',
      props: {},
      children: [{ props: {} }],
    });
    expect(result.success).toBe(false);
  });

  it('requires title and description on seo meta', () => {
    expect(
      seoMetaSchema.safeParse({ title: 'x', description: 'y' }).success,
    ).toBe(true);
    expect(seoMetaSchema.safeParse({ title: 'x' }).success).toBe(false);
  });
});
