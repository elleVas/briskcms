import { describe, expect, it } from 'vitest';
import { delegatedRootClass } from './delegated-root-class';

describe('delegatedRootClass', () => {
  it('puts the type class before the instance class', () => {
    expect(delegatedRootClass('brisk-buy-button', 'brisk-b-1')).toBe(
      'brisk-buy-button brisk-b-1',
    );
  });

  it('is the type class alone for a block with no style of its own', () => {
    expect(delegatedRootClass('brisk-map-embed', null)).toBe('brisk-map-embed');
    expect(delegatedRootClass('brisk-map-embed', undefined)).toBe(
      'brisk-map-embed',
    );
  });
});
