import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { QueryClientProvider } from '@tanstack/react-query';
import type { PageTranslationRecord } from '@brisk/shared-types';
import * as api from '../lib/page-groups-api-client';
import { createTestQueryClient } from '../test-query-client';
import { PageGroupTranslationsDialog } from './page-group-translations-dialog';

vi.mock('../lib/page-groups-api-client', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('../lib/page-groups-api-client')>();
  return {
    ...actual,
    createPageGroupTranslation: vi.fn(),
    renamePageTranslation: vi.fn(),
  };
});

function translation(
  overrides: Partial<PageTranslationRecord> & { id: string; locale: string },
): PageTranslationRecord {
  return {
    tenantId: 'tenant-1',
    siteId: 'site-1',
    pageGroupId: 'group-1',
    slug: 'chi-siamo',
    seoMeta: { title: 'Chi siamo', description: '' },
    fieldValues: {},
    status: 'published',
    publishedSnapshot: null,
    isDiverged: false,
    divergedContent: null,
    createdBy: null,
    createdAt: '',
    updatedAt: '',
    ...overrides,
  } as PageTranslationRecord;
}

function renderDialog(translations: PageTranslationRecord[]) {
  return render(
    <QueryClientProvider client={createTestQueryClient()}>
      <PageGroupTranslationsDialog
        groupId="group-1"
        parentGroupId={null}
        translations={translations}
        enabledLocales={['it', 'en']}
        activeLocale="it"
        onSelectLocale={() => undefined}
        open
        onOpenChange={() => undefined}
      />
    </QueryClientProvider>,
  );
}

/*
 * A page's address used to be chosen once, at creation, from the title it
 * was born with — so a typo was its URL for good and the only way out was
 * deleting the page and losing its version history. This dialog is where
 * that stopped being true.
 */
describe('renaming a page from the translations dialog', () => {
  afterEach(() => vi.clearAllMocks());

  it('moves the page to the address that was typed', async () => {
    vi.mocked(api.renamePageTranslation).mockResolvedValue(
      translation({ id: 'tr-1', locale: 'it', slug: 'la-nostra-storia' }),
    );
    renderDialog([translation({ id: 'tr-1', locale: 'it' })]);

    const field = screen.getByLabelText('URL in IT');
    fireEvent.blur(field, { target: { value: 'la-nostra-storia' } });

    await waitFor(() =>
      expect(api.renamePageTranslation).toHaveBeenCalledWith(
        'tr-1',
        'la-nostra-storia',
        null,
      ),
    );
  });

  it('slugifies what was typed rather than refusing it', async () => {
    vi.mocked(api.renamePageTranslation).mockResolvedValue(
      translation({ id: 'tr-1', locale: 'it', slug: 'la-nostra-storia' }),
    );
    renderDialog([translation({ id: 'tr-1', locale: 'it' })]);

    fireEvent.blur(screen.getByLabelText('URL in IT'), {
      target: { value: 'La Nostra Storia' },
    });

    await waitFor(() =>
      expect(api.renamePageTranslation).toHaveBeenCalledWith(
        'tr-1',
        'la-nostra-storia',
        null,
      ),
    );
  });

  it('asks for nothing when the address did not change', () => {
    renderDialog([translation({ id: 'tr-1', locale: 'it' })]);

    fireEvent.blur(screen.getByLabelText('URL in IT'), {
      target: { value: 'chi-siamo' },
    });

    expect(api.renamePageTranslation).not.toHaveBeenCalled();
  });

  /*
   * The database refuses a duplicate address, and the person who typed it
   * has to be told which one is taken — a field that silently snaps back
   * looks like a bug in the field.
   */
  it('says why, and restores the address, when the new one is taken', async () => {
    vi.mocked(api.renamePageTranslation).mockRejectedValue(
      new Error('slug already exists'),
    );
    renderDialog([translation({ id: 'tr-1', locale: 'it' })]);

    const field = screen.getByLabelText('URL in IT') as HTMLInputElement;
    fireEvent.blur(field, { target: { value: 'contatti' } });

    expect((await screen.findByRole('alert')).textContent).toMatch(
      /slug already exists/,
    );
    expect(field.value).toBe('chi-siamo');
  });

  it('names the language each address belongs to', () => {
    renderDialog([
      translation({ id: 'tr-1', locale: 'it' }),
      translation({ id: 'tr-2', locale: 'en', slug: 'about-us' }),
    ]);

    expect(screen.getByLabelText('URL in IT')).toBeTruthy();
    expect(screen.getByLabelText('URL in EN')).toBeTruthy();
  });
});
