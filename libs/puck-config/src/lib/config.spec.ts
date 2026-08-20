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
      'Container',
      'Link',
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
      'VideoEmbed',
      'MapEmbed',
      'ImageSlider',
      'BeforeAfter',
      'LogoStrip',
      'Testimonials',
      'Testimonial',
      'Team',
      'TeamMember',
      'PricingTable',
      'PricingPlan',
      'StatsCounter',
      'Stat',
      'Timeline',
      'TimelineStep',
      'NewsletterSignup',
    ]);
    expect(typeof puckConfig.components.Hero.render).toBe('function');
    expect(typeof puckConfig.components.Text.render).toBe('function');
    expect(typeof puckConfig.components.Image.render).toBe('function');
    expect(typeof puckConfig.components.Gallery.render).toBe('function');
    expect(typeof puckConfig.components.Form.render).toBe('function');
    expect(typeof puckConfig.components.Columns.render).toBe('function');
    expect(typeof puckConfig.components.Column.render).toBe('function');
    expect(typeof puckConfig.components.Container.render).toBe('function');
    expect(typeof puckConfig.components.Link.render).toBe('function');
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
    expect(typeof puckConfig.components.VideoEmbed.render).toBe('function');
    expect(typeof puckConfig.components.MapEmbed.render).toBe('function');
    expect(typeof puckConfig.components.ImageSlider.render).toBe('function');
    expect(typeof puckConfig.components.BeforeAfter.render).toBe('function');
    expect(typeof puckConfig.components.LogoStrip.render).toBe('function');
    expect(typeof puckConfig.components.Testimonials.render).toBe('function');
    expect(typeof puckConfig.components.Testimonial.render).toBe('function');
    expect(typeof puckConfig.components.Team.render).toBe('function');
    expect(typeof puckConfig.components.TeamMember.render).toBe('function');
    expect(typeof puckConfig.components.PricingTable.render).toBe('function');
    expect(typeof puckConfig.components.PricingPlan.render).toBe('function');
    expect(typeof puckConfig.components.StatsCounter.render).toBe('function');
    expect(typeof puckConfig.components.Stat.render).toBe('function');
    expect(typeof puckConfig.components.Timeline.render).toBe('function');
    expect(typeof puckConfig.components.TimelineStep.render).toBe('function');
    expect(typeof puckConfig.components.NewsletterSignup.render).toBe(
      'function',
    );
  });
});
