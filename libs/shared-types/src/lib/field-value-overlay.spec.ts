import { describe, expect, it } from 'vitest';
import { mergeTranslatedContent } from './field-value-overlay';
import type { PageContent } from './content-model';

describe('mergeTranslatedContent', () => {
  it('overlays only the fields present in the overlay for a matching block id', () => {
    const groupContent: PageContent = [
      {
        id: 'hero-1',
        type: 'Hero',
        props: { title: 'Titolo', subtitle: 'Sottotitolo' },
      },
    ];

    const merged = mergeTranslatedContent(groupContent, {
      'hero-1': { title: 'Title' },
    });

    expect(merged).toEqual([
      {
        id: 'hero-1',
        type: 'Hero',
        props: { title: 'Title', subtitle: 'Sottotitolo' },
      },
    ]);
  });

  it('falls back to the shared value for a field with no override', () => {
    const groupContent: PageContent = [
      { id: 'text-1', type: 'Text', props: { body: 'Testo condiviso' } },
    ];

    const merged = mergeTranslatedContent(groupContent, {});

    expect(merged).toEqual(groupContent);
  });

  it('recurses into children, overlaying each nested block independently', () => {
    const groupContent: PageContent = [
      {
        id: 'container-1',
        type: 'Container',
        props: {},
        children: [
          { id: 'text-1', type: 'Text', props: { body: 'Uno' } },
          { id: 'text-2', type: 'Text', props: { body: 'Due' } },
        ],
      },
    ];

    const merged = mergeTranslatedContent(groupContent, {
      'text-2': { body: 'Two' },
    });

    expect(merged).toEqual([
      {
        id: 'container-1',
        type: 'Container',
        props: {},
        children: [
          { id: 'text-1', type: 'Text', props: { body: 'Uno' } },
          { id: 'text-2', type: 'Text', props: { body: 'Two' } },
        ],
      },
    ]);
  });

  it('never overrides a block with no id, even if the overlay somehow keys on undefined', () => {
    const groupContent: PageContent = [
      { type: 'Text', props: { body: 'Senza id' } },
    ];

    const merged = mergeTranslatedContent(groupContent, {
      undefined: { body: 'Should never apply' },
    } as unknown as Record<string, Record<string, string>>);

    expect(merged).toEqual(groupContent);
  });

  it('leaves styleOverride and every other block field untouched', () => {
    const groupContent: PageContent = [
      {
        id: 'hero-1',
        type: 'Hero',
        props: { title: 'Titolo' },
        styleOverride: { borderRadius: '4px' },
      },
    ];

    const merged = mergeTranslatedContent(groupContent, {
      'hero-1': { title: 'Title' },
    });

    expect(merged[0].styleOverride).toEqual({ borderRadius: '4px' });
  });
});
