import { describe, expect, it } from 'vitest';
import { heroPropsSchema } from './hero.block.js';

describe('heroPropsSchema', () => {
  it('accepts valid Hero props', () => {
    const result = heroPropsSchema.safeParse({
      title: 'Ciao',
      subtitle: 'Sottotitolo',
    });
    expect(result.success).toBe(true);
  });

  it('rejects Hero props missing a subtitle', () => {
    const result = heroPropsSchema.safeParse({ title: 'Ciao' });
    expect(result.success).toBe(false);
  });
});
