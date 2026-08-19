import { describe, expect, it } from 'vitest';
import { headerFooterPuckConfig } from './layout-config.js';

describe('headerFooterPuckConfig', () => {
  it('registers only the site-chrome blocks, never Hero/Gallery/Form', () => {
    expect(Object.keys(headerFooterPuckConfig.components)).toEqual([
      'Nav',
      'NavLink',
      'LanguageSwitcher',
      'HamburgerMenu',
      'Text',
      'Image',
    ]);
  });

  it('registers a render function for every configured block', () => {
    for (const component of Object.values(headerFooterPuckConfig.components)) {
      expect(typeof component.render).toBe('function');
    }
  });
});
