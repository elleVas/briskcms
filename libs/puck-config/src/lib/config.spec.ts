import { describe, expect, it } from 'vitest';
import { puckConfig } from './config.js';

describe('puckConfig', () => {
  it('registers a render function for every configured block', () => {
    expect(Object.keys(puckConfig.components)).toEqual([
      'Hero',
      'Text',
      'Image',
      'Gallery',
    ]);
    expect(typeof puckConfig.components.Hero.render).toBe('function');
    expect(typeof puckConfig.components.Text.render).toBe('function');
    expect(typeof puckConfig.components.Image.render).toBe('function');
    expect(typeof puckConfig.components.Gallery.render).toBe('function');
  });
});
