import type { ReactNode } from 'react';
import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { QueryClientProvider } from '@tanstack/react-query';
import type { Block } from '@brisk/shared-types';
import * as api from '../lib/page-groups-api-client';
import { createTestQueryClient } from '../test-query-client';
import {
  pageGroupQueryOptions,
  pageGroupTranslationsQueryOptions,
} from './page-groups-queries';
import { usePageGroupEditor } from './use-page-group-editor';

vi.mock('../lib/page-groups-api-client', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('../lib/page-groups-api-client')>();
  return {
    ...actual,
    savePageGroupContent: vi.fn(),
    saveDivergedPageTranslationContent: vi.fn(),
    savePageTranslationFieldValues: vi.fn(),
    publishPageTranslation: vi.fn(),
    divergePageTranslation: vi.fn(),
  };
});

const groupContent: Block[] = [
  { id: 'hero-1', type: 'Hero', props: { title: 'Hello' } },
];

const sampleGroup: api.PageGroupRecord = {
  id: 'group-1',
  tenantId: 'tenant-1',
  siteId: 'site-1',
  parentId: null,
  order: 0,
  content: groupContent,
  createdBy: null,
  createdAt: '',
  updatedAt: '',
};

const enTranslation: api.PageTranslationRecord = {
  id: 'translation-en',
  tenantId: 'tenant-1',
  siteId: 'site-1',
  pageGroupId: 'group-1',
  locale: 'en',
  slug: 'home',
  seoMeta: { title: 'Home', description: '' },
  fieldValues: {},
  status: 'draft',
  publishedSnapshot: null,
  isDiverged: false,
  divergedContent: null,
  createdBy: null,
  createdAt: '',
  updatedAt: '',
};

const itTranslation: api.PageTranslationRecord = {
  ...enTranslation,
  id: 'translation-it',
  locale: 'it',
  slug: 'home-it',
  fieldValues: { 'hero-1': { title: 'Ciao' } },
};

const divergedTranslation: api.PageTranslationRecord = {
  ...enTranslation,
  id: 'translation-diverged',
  locale: 'fr',
  slug: 'home-fr',
  isDiverged: true,
  divergedContent: [
    { id: 'hero-1', type: 'Hero', props: { title: 'Bonjour' } },
  ],
};

function renderPageGroupEditor(
  translations: api.PageTranslationRecord[] = [enTranslation, itTranslation],
  initialLocale = 'en',
) {
  const queryClient = createTestQueryClient();
  queryClient.setQueryData(
    pageGroupQueryOptions(sampleGroup.id).queryKey,
    sampleGroup,
  );
  queryClient.setQueryData(
    pageGroupTranslationsQueryOptions(sampleGroup.id).queryKey,
    translations,
  );
  function wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  }
  return {
    ...renderHook(() => usePageGroupEditor(sampleGroup.id, initialLocale), {
      wrapper,
    }),
    queryClient,
  };
}

describe('usePageGroupEditor', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('starts with the cached group/translations, idle status, and the requested active locale', () => {
    const { result } = renderPageGroupEditor();

    expect(result.current.group).toEqual(sampleGroup);
    expect(result.current.activeLocale).toBe('en');
    expect(result.current.activeTranslation).toEqual(enTranslation);
    expect(result.current.status).toEqual({ kind: 'idle' });
  });

  it('displayedBlocks merges group content with the active translation fieldValues', () => {
    const { result } = renderPageGroupEditor(
      [enTranslation, itTranslation],
      'it',
    );

    expect(result.current.displayedBlocks).toEqual([
      { id: 'hero-1', type: 'Hero', props: { title: 'Ciao' } },
    ]);
  });

  it('displayedBlocks is the raw divergedContent for a diverged translation, ignoring group content', () => {
    const { result } = renderPageGroupEditor(
      [enTranslation, divergedTranslation],
      'fr',
    );

    expect(result.current.displayedBlocks).toEqual(
      divergedTranslation.divergedContent,
    );
  });

  it('setActiveLocale switches which translation is active and what is displayed', () => {
    const { result } = renderPageGroupEditor();

    act(() => {
      result.current.setActiveLocale('it');
    });

    expect(result.current.activeTranslation).toEqual(itTranslation);
    expect(result.current.displayedBlocks).toEqual([
      { id: 'hero-1', type: 'Hero', props: { title: 'Ciao' } },
    ]);
  });

  it('onChange saves the shared structure for a linked translation', async () => {
    vi.mocked(api.savePageGroupContent).mockResolvedValue(sampleGroup);
    const { result } = renderPageGroupEditor();
    const nextContent: Block[] = [
      { id: 'hero-1', type: 'Hero', props: { title: 'Hello v2' } },
    ];

    await act(async () => {
      result.current.onChange(nextContent);
    });

    expect(api.savePageGroupContent).toHaveBeenCalledWith(
      sampleGroup.id,
      nextContent,
    );
    expect(api.saveDivergedPageTranslationContent).not.toHaveBeenCalled();
  });

  it('onChange saves divergedContent instead, for a diverged translation', async () => {
    vi.mocked(api.saveDivergedPageTranslationContent).mockResolvedValue(
      divergedTranslation,
    );
    const { result } = renderPageGroupEditor(
      [enTranslation, divergedTranslation],
      'fr',
    );
    const nextContent: Block[] = [
      { id: 'hero-1', type: 'Hero', props: { title: 'Bonjour v2' } },
    ];

    await act(async () => {
      result.current.onChange(nextContent);
    });

    expect(api.saveDivergedPageTranslationContent).toHaveBeenCalledWith(
      divergedTranslation.id,
      nextContent,
      sampleGroup.parentId,
    );
    expect(api.savePageGroupContent).not.toHaveBeenCalled();
  });

  it('onSaveFieldValue saves a merged fieldValues overlay for the active translation and updates it optically', async () => {
    vi.mocked(api.savePageTranslationFieldValues).mockResolvedValue({
      ...itTranslation,
      fieldValues: { 'hero-1': { title: 'Ciao aggiornato' } },
    });
    const { result } = renderPageGroupEditor(
      [enTranslation, itTranslation],
      'it',
    );

    await act(async () => {
      result.current.onSaveFieldValue('hero-1', 'title', 'Ciao aggiornato');
      // Flushes the optical setQueryData update, which — unlike the mutation
      // itself — happens before the network round-trip even starts.
      await Promise.resolve();
    });

    expect(result.current.displayedBlocks).toEqual([
      { id: 'hero-1', type: 'Hero', props: { title: 'Ciao aggiornato' } },
    ]);

    expect(api.savePageTranslationFieldValues).toHaveBeenCalledWith(
      itTranslation.id,
      { 'hero-1': { title: 'Ciao aggiornato' } },
      sampleGroup.parentId,
    );
  });

  it('handlePublish publishes the active translation', async () => {
    vi.mocked(api.publishPageTranslation).mockResolvedValue({
      ...enTranslation,
      status: 'published',
    });
    const { result } = renderPageGroupEditor();

    await act(async () => {
      await result.current.handlePublish();
    });

    expect(api.publishPageTranslation).toHaveBeenCalledWith(enTranslation.id);
    expect(result.current.status).toEqual({ kind: 'published' });
  });

  it('handleDiverge diverges the active translation', async () => {
    vi.mocked(api.divergePageTranslation).mockResolvedValue({
      ...itTranslation,
      isDiverged: true,
      divergedContent: groupContent,
    });
    const { result } = renderPageGroupEditor(
      [enTranslation, itTranslation],
      'it',
    );

    await act(async () => {
      await result.current.handleDiverge();
    });

    expect(api.divergePageTranslation).toHaveBeenCalledWith(itTranslation.id);
  });
});
