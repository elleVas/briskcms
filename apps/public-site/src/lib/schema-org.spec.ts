import { describe, expect, it } from 'vitest';
import type { PublishedSiteDto } from './public-api-client.js';
import { buildSchemaOrgGraph } from './schema-org.js';

const seoMeta = { title: 'Chi siamo', description: 'La nostra storia' };
const pageUrl = 'https://example.com/chi-siamo';

const siteWithoutBusinessInfo: PublishedSiteDto = {
  name: 'Sito di prova',
  domain: 'example.com',
  businessAddress: null,
  businessPhone: null,
  businessType: null,
  openingHours: null,
  searchEngineIndexingEnabled: false,
};

describe('buildSchemaOrgGraph', () => {
  it('always includes WebSite and WebPage nodes', () => {
    const graph = buildSchemaOrgGraph({
      site: siteWithoutBusinessInfo,
      seoMeta,
      pageUrl,
    });

    expect(graph['@context']).toBe('https://schema.org');
    const nodes = graph['@graph'] as Record<string, unknown>[];
    expect(nodes.map((node) => node['@type'])).toEqual(['WebSite', 'WebPage']);
    expect(nodes[1]).toMatchObject({
      name: 'Chi siamo',
      description: 'La nostra storia',
      url: pageUrl,
    });
  });

  it('omits LocalBusiness when the site has no business info', () => {
    const graph = buildSchemaOrgGraph({
      site: siteWithoutBusinessInfo,
      seoMeta,
      pageUrl,
    });

    const nodes = graph['@graph'] as Record<string, unknown>[];
    expect(nodes).toHaveLength(2);
  });

  it('adds a LocalBusiness node using businessType as @type when business info is set', () => {
    const site: PublishedSiteDto = {
      ...siteWithoutBusinessInfo,
      businessAddress: 'Via Roma 1, Milano',
      businessPhone: '+39 02 1234567',
      businessType: 'ProfessionalService',
      openingHours: [
        {
          dayOfWeek: 'monday',
          ranges: [
            { opens: '09:00', closes: '13:00' },
            { opens: '14:00', closes: '18:00' },
          ],
        },
      ],
    };

    const graph = buildSchemaOrgGraph({ site, seoMeta, pageUrl });
    const nodes = graph['@graph'] as Record<string, unknown>[];
    const business = nodes[2];

    expect(business).toMatchObject({
      '@type': 'ProfessionalService',
      name: 'Sito di prova',
      address: 'Via Roma 1, Milano',
      telephone: '+39 02 1234567',
    });
    expect(business['openingHoursSpecification']).toEqual([
      {
        '@type': 'OpeningHoursSpecification',
        dayOfWeek: 'https://schema.org/Monday',
        opens: '09:00',
        closes: '13:00',
      },
      {
        '@type': 'OpeningHoursSpecification',
        dayOfWeek: 'https://schema.org/Monday',
        opens: '14:00',
        closes: '18:00',
      },
    ]);
  });

  it('falls back to plain "LocalBusiness" when businessType is not set', () => {
    const site: PublishedSiteDto = {
      ...siteWithoutBusinessInfo,
      businessAddress: 'Via Roma 1, Milano',
    };

    const graph = buildSchemaOrgGraph({ site, seoMeta, pageUrl });
    const nodes = graph['@graph'] as Record<string, unknown>[];

    expect(nodes[2]['@type']).toBe('LocalBusiness');
  });
});
