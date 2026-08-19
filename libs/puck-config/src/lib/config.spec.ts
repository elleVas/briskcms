import { describe, expect, it } from 'vitest';
import { puckConfig } from './config.js';

describe('puckConfig', () => {
  it('registers a render function for every configured block', () => {
    expect(Object.keys(puckConfig.components)).toEqual([
      'Hero',
      'Text',
      'Image',
      'Gallery',
      'Form',
      'Columns',
      'Column',
      'Quote',
      'Rating',
      'Countdown',
      'EmbedHtml',
      'Table',
      'Accordion',
      'AccordionItem',
      'Tabs',
      'Tab',
      'Banner',
      'Button',
      'FeatureGrid',
      'Feature',
      'SearchBox',
    ]);
    expect(typeof puckConfig.components.Hero.render).toBe('function');
    expect(typeof puckConfig.components.Text.render).toBe('function');
    expect(typeof puckConfig.components.Image.render).toBe('function');
    expect(typeof puckConfig.components.Gallery.render).toBe('function');
    expect(typeof puckConfig.components.Form.render).toBe('function');
    expect(typeof puckConfig.components.Columns.render).toBe('function');
    expect(typeof puckConfig.components.Column.render).toBe('function');
    expect(typeof puckConfig.components.Quote.render).toBe('function');
    expect(typeof puckConfig.components.Rating.render).toBe('function');
    expect(typeof puckConfig.components.Countdown.render).toBe('function');
    expect(typeof puckConfig.components.EmbedHtml.render).toBe('function');
    expect(typeof puckConfig.components.Table.render).toBe('function');
    expect(typeof puckConfig.components.Accordion.render).toBe('function');
    expect(typeof puckConfig.components.AccordionItem.render).toBe('function');
    expect(typeof puckConfig.components.Tabs.render).toBe('function');
    expect(typeof puckConfig.components.Tab.render).toBe('function');
    expect(typeof puckConfig.components.Banner.render).toBe('function');
    expect(typeof puckConfig.components.Button.render).toBe('function');
    expect(typeof puckConfig.components.FeatureGrid.render).toBe('function');
    expect(typeof puckConfig.components.Feature.render).toBe('function');
    expect(typeof puckConfig.components.SearchBox.render).toBe('function');
  });
});
