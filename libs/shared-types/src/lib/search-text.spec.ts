import { describe, expect, it } from 'vitest';
import { extractSearchableText } from './search-text';
import type { PageContent, SeoMeta } from './content-model';

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

  it('extracts alt text from every image in a Gallery', () => {
    const blocks: PageContent = [
      {
        type: 'Gallery',
        props: {
          images: [{ alt: 'Foto sala' }, { alt: 'Foto cucina' }],
        },
      },
    ];

    const text = extractSearchableText(seoMeta, blocks);

    expect(text).toContain('Foto sala');
    expect(text).toContain('Foto cucina');
  });

  it('extracts alt and caption from Image', () => {
    const blocks: PageContent = [
      {
        type: 'Image',
        props: { alt: 'Facciata', caption: 'Ingresso principale' },
      },
    ];

    const text = extractSearchableText(seoMeta, blocks);

    expect(text).toContain('Facciata');
    expect(text).toContain('Ingresso principale');
  });

  it('extracts label from Rating, Countdown, Tab and Button', () => {
    for (const type of ['Rating', 'Countdown', 'Tab', 'Button']) {
      const text = extractSearchableText(seoMeta, [
        { type, props: { label: `Etichetta ${type}` } },
      ]);
      expect(text).toContain(`Etichetta ${type}`);
    }
  });

  it('flattens every cell of a Table', () => {
    const blocks: PageContent = [
      {
        type: 'Table',
        props: {
          rows: [
            ['Servizio', 'Prezzo'],
            ['Idraulica', '50€'],
          ],
        },
      },
    ];

    const text = extractSearchableText(seoMeta, blocks);

    expect(text).toContain('Servizio');
    expect(text).toContain('Idraulica');
    expect(text).toContain('50€');
  });

  it('extracts question and answer from AccordionItem', () => {
    const blocks: PageContent = [
      {
        type: 'AccordionItem',
        props: { question: 'Fate preventivi?', answer: 'Sì, gratuiti' },
      },
    ];

    const text = extractSearchableText(seoMeta, blocks);

    expect(text).toContain('Fate preventivi?');
    expect(text).toContain('Sì, gratuiti');
  });

  it('extracts title, text and buttonLabel from Banner', () => {
    const blocks: PageContent = [
      {
        type: 'Banner',
        props: {
          title: 'Offerta limitata',
          text: 'Solo questo mese',
          buttonLabel: 'Approfitta ora',
        },
      },
    ];

    const text = extractSearchableText(seoMeta, blocks);

    expect(text).toContain('Offerta limitata');
    expect(text).toContain('Solo questo mese');
    expect(text).toContain('Approfitta ora');
  });

  it('extracts title and text from Feature', () => {
    const blocks: PageContent = [
      {
        type: 'Feature',
        props: { icon: '🚀', title: 'Veloce', text: 'Interventi rapidi' },
      },
    ];

    const text = extractSearchableText(seoMeta, blocks);

    expect(text).toContain('Veloce');
    expect(text).toContain('Interventi rapidi');
    expect(text).not.toContain('🚀');
  });

  it('extracts message from PromoBar and WhatsAppButton', () => {
    for (const type of ['PromoBar', 'WhatsAppButton']) {
      const text = extractSearchableText(seoMeta, [
        { type, props: { message: `Messaggio ${type}` } },
      ]);
      expect(text).toContain(`Messaggio ${type}`);
    }
  });

  it('extracts label from NavLink and NavDropdown', () => {
    for (const type of ['NavLink', 'NavDropdown']) {
      const text = extractSearchableText(seoMeta, [
        { type, props: { label: `Voce ${type}` } },
      ]);
      expect(text).toContain(`Voce ${type}`);
    }
  });

  it('skips a block with missing/non-string prose props instead of throwing', () => {
    const blocks: PageContent = [
      { type: 'Hero', props: {} },
      { type: 'Gallery', props: {} },
    ];

    expect(() => extractSearchableText(seoMeta, blocks)).not.toThrow();
  });
});
