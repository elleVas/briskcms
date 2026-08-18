import { describe, expect, it } from 'vitest';
import { buildSchemaOrgGraph } from './schema-org.js';
import type { PublishedSiteDto } from './public-api-client.js';

const baseSite: PublishedSiteDto = {
  name: 'Il mio sito',
  domain: 'example.com',
  businessAddress: null,
  businessPhone: null,
  businessType: null,
  openingHours: null,
  searchEngineIndexingEnabled: false,
};

const seoMeta = { title: 'Chi siamo', description: 'La nostra storia' };

describe('buildSchemaOrgGraph', () => {
  it('includes WebSite and WebPage but no LocalBusiness when the site has no business info', () => {
    const graph = buildSchemaOrgGraph({
      site: baseSite,
      seoMeta,
      pageUrl: 'https://example.com/chi-siamo',
    }) as { '@graph': { '@type': string }[] };

    const types = graph['@graph'].map((node) => node['@type']);
    expect(types).toEqual(['WebSite', 'WebPage']);
  });

  it('adds a LocalBusiness node once any business field is set', () => {
    const graph = buildSchemaOrgGraph({
      site: { ...baseSite, businessPhone: '+39 02 1234567' },
      seoMeta,
      pageUrl: 'https://example.com/chi-siamo',
    }) as { '@graph': { '@type': string; telephone?: string }[] };

    const business = graph['@graph'].find(
      (node) => node['@type'] !== 'WebSite' && node['@type'] !== 'WebPage',
    );
    expect(business?.telephone).toBe('+39 02 1234567');
  });

  it('uses the site businessType as the schema.org @type when set', () => {
    const graph = buildSchemaOrgGraph({
      site: {
        ...baseSite,
        businessType: 'Restaurant',
        businessPhone: '+39 02 1234567',
      },
      seoMeta,
      pageUrl: 'https://example.com/chi-siamo',
    }) as { '@graph': { '@type': string }[] };

    const business = graph['@graph'][2];
    expect(business['@type']).toBe('Restaurant');
  });

  it('falls back to the generic LocalBusiness type when businessType is not set', () => {
    const graph = buildSchemaOrgGraph({
      site: { ...baseSite, businessAddress: 'Via Roma 1' },
      seoMeta,
      pageUrl: 'https://example.com/chi-siamo',
    }) as { '@graph': { '@type': string }[] };

    expect(graph['@graph'][2]['@type']).toBe('LocalBusiness');
  });

  it('expands multi-range opening hours into one OpeningHoursSpecification per range', () => {
    const graph = buildSchemaOrgGraph({
      site: {
        ...baseSite,
        openingHours: [
          {
            dayOfWeek: 'monday',
            ranges: [
              { opens: '09:00', closes: '13:00' },
              { opens: '15:00', closes: '19:00' },
            ],
          },
          { dayOfWeek: 'sunday', ranges: [] },
        ],
      },
      seoMeta,
      pageUrl: 'https://example.com/chi-siamo',
    }) as {
      '@graph': {
        openingHoursSpecification?: { dayOfWeek: string; opens: string }[];
      }[];
    };

    const business = graph['@graph'][2];
    expect(business.openingHoursSpecification).toEqual([
      {
        '@type': 'OpeningHoursSpecification',
        dayOfWeek: 'https://schema.org/Monday',
        opens: '09:00',
        closes: '13:00',
      },
      {
        '@type': 'OpeningHoursSpecification',
        dayOfWeek: 'https://schema.org/Monday',
        opens: '15:00',
        closes: '19:00',
      },
    ]);
  });
});
