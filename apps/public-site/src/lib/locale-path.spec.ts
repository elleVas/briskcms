import { describe, expect, it } from 'vitest';
import { localePath } from './locale-path.js';

describe('localePath', () => {
  it('maps the "home" slug to the bare locale root', () => {
    expect(localePath('it', 'home')).toBe('/it/');
  });

  it('maps any other slug to a locale-prefixed path', () => {
    expect(localePath('en', 'about-us')).toBe('/en/about-us');
  });
});
