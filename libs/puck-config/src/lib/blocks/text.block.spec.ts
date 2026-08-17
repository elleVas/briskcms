import { describe, expect, it } from 'vitest';
import { textPropsSchema } from './text.block.js';

describe('textPropsSchema', () => {
  it('accepts valid Text props', () => {
    const result = textPropsSchema.safeParse({ body: 'Un paragrafo.' });
    expect(result.success).toBe(true);
  });

  it('rejects Text props without a body', () => {
    const result = textPropsSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});
