import { describe, expect, it } from 'vitest';
import { extractSearchableText } from './search-text.js';
import type { PageContent, SeoMeta } from './content-model.js';

const seoMeta: SeoMeta = {
  title: 'Chi siamo',
  description: 'La nostra storia',
};

describe('extractSearchableText', () => {
  it('includes the SEO title and description', () => {
    const text = extractSearchableText(seoMeta, []);
    expect(text).toContain('Chi siamo');
    expect(text).toContain('La nostra storia');
  });

  it('extracts prose fields from known block types', () => {
    const blocks: PageContent = [
      { type: 'Hero', props: { title: 'Benvenuti', subtitle: 'da noi' } },
      { type: 'Text', props: { body: 'Testo del blocco' } },
      {
        type: 'Quote',
        props: { quote: 'Ottimo servizio', author: 'Mario', role: 'Cliente' },
      },
    ];

    const text = extractSearchableText(seoMeta, blocks);

    expect(text).toContain('Benvenuti');
    expect(text).toContain('da noi');
    expect(text).toContain('Testo del blocco');
    expect(text).toContain('Ottimo servizio');
    expect(text).toContain('Mario');
  });

  it('walks nested children (e.g. Columns > Column > Text)', () => {
    const blocks: PageContent = [
      {
        type: 'Columns',
        props: {},
        children: [
          {
            type: 'Column',
            props: {},
            children: [{ type: 'Text', props: { body: 'Testo annidato' } }],
          },
        ],
      },
    ];

    expect(extractSearchableText(seoMeta, blocks)).toContain('Testo annidato');
  });

  it('ignores non-prose props and unlisted block types', () => {
    const blocks: PageContent = [
      {
        type: 'Button',
        props: {
          label: 'Scopri di più',
          linkType: 'url',
          url: 'https://example.com/secret-path',
          variant: 'primary',
        },
      },
      { type: 'EmbedHtml', props: { html: '<script>evil()</script>' } },
    ];

    const text = extractSearchableText(seoMeta, blocks);

    expect(text).toContain('Scopri di più');
    expect(text).not.toContain('https://example.com/secret-path');
    expect(text).not.toContain('primary');
    expect(text).not.toContain('evil');
  });
});
