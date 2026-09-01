import type { ReactNode } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { QueryClientProvider } from '@tanstack/react-query';
import type { SiteRecord } from '@brisk/shared-types';
import { DEFAULT_COOKIE_BANNER_SETTINGS } from '@brisk/shared-types';
import * as api from '../lib/legal-documents-api-client';
import { createTestQueryClient } from '../test-query-client';
import { LegalDocumentsWizard } from './legal-documents-wizard';

vi.mock('../lib/legal-documents-api-client', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('../lib/legal-documents-api-client')>();
  return {
    ...actual,
    previewLegalDocuments: vi.fn(),
    generateLegalDocuments: vi.fn(),
  };
});

// Same mock as cookie-banner-view.spec.tsx: `Link` needs a real router
// context to resolve `useLinkProps`, which this component-only render
// doesn't provide.
vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@tanstack/react-router')>();
  return {
    ...actual,
    Link: ({
      children,
      to,
      params,
    }: {
      children: ReactNode;
      to: string;
      params?: Record<string, string>;
    }) => (
      <a href={params ? `${to}/${Object.values(params)[0]}` : to}>{children}</a>
    ),
  };
});

const site: SiteRecord = {
  id: 'site-1',
  tenantId: 'tenant-1',
  name: 'Il mio sito',
  domain: 'example.com',
  defaultLocale: 'it',
  enabledLocales: ['it', 'en'],
  untranslatedPageFallback: 'redirect-to-default',
  businessAddress: 'Via Roma 1',
  businessPhone: '+39 02 1234567',
  businessType: null,
  openingHours: null,
  searchEngineIndexingEnabled: false,
  themePrimaryColor: null,
  themeSecondaryColor: null,
  themeFontFamily: null,
  themeCustomCss: null,
  themeHeadScript: null,
  themeBodyScript: null,
  themeFaviconUrl: null,
  themeOverridesEnabled: true,
  themeAllowedTrackerDomains: [
    { label: 'Hotjar', domain: 'static.hotjar.com' },
  ],
  formSubmissionRetentionDays: 90,
  themeTrackerScripts: [
    {
      id: 't1',
      label: 'Google Analytics',
      category: 'measurement',
      placement: 'head',
      html: '',
    },
  ],
  cookieBannerSettings: DEFAULT_COOKIE_BANNER_SETTINGS,
  themeTokens: { blockStyles: {} },
  createdAt: '',
};

function renderWizard() {
  return render(
    <QueryClientProvider client={createTestQueryClient()}>
      <LegalDocumentsWizard siteId="site-1" site={site} />
    </QueryClientProvider>,
  );
}

describe('LegalDocumentsWizard', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('pre-fills identity fields from the site and business info', () => {
    renderWizard();

    expect(screen.getByDisplayValue('Il mio sito')).toBeTruthy();
    expect(screen.getByDisplayValue('example.com')).toBeTruthy();
    expect(screen.getByDisplayValue('Via Roma 1')).toBeTruthy();
    expect(screen.getByDisplayValue('+39 02 1234567')).toBeTruthy();
  });

  it('blocks moving to the next step when a required field is empty', async () => {
    renderWizard();

    fireEvent.click(screen.getByRole('button', { name: /avanti/i }));

    // Still on step 1 — contactEmail is required and was left blank, so the
    // step-2-only field never renders.
    await waitFor(() => {
      expect(screen.queryByText('Dati raccolti')).toBeNull();
    });
    expect(screen.getByDisplayValue('Il mio sito')).toBeTruthy();
  });

  it('pre-fills third-party services from the tracker list and allowed domains', async () => {
    renderWizard();

    fireEvent.change(screen.getByLabelText(/email di contatto privacy/i), {
      target: { value: 'privacy@example.com' },
    });
    fireEvent.click(screen.getByRole('button', { name: /avanti/i }));

    expect(await screen.findByText('Google Analytics')).toBeTruthy();
    expect(screen.getByText('Hotjar')).toBeTruthy();
    expect(screen.getByDisplayValue('90')).toBeTruthy();
  });

  it('walks the whole flow and creates drafts, linking to each one', async () => {
    vi.mocked(api.previewLegalDocuments).mockResolvedValue({
      documents: [
        {
          kind: 'privacy-policy',
          locales: {
            it: {
              title: 'Privacy Policy',
              sections: [{ heading: 'Titolare', paragraphs: ['Testo.'] }],
            },
          },
        },
      ],
    });
    vi.mocked(api.generateLegalDocuments).mockResolvedValue({
      documents: [
        {
          kind: 'privacy-policy',
          pageGroupId: 'group-1',
          translations: [
            { locale: 'it', translationId: 'tr-1', slug: 'privacy-policy' },
          ],
        },
      ],
    });
    renderWizard();

    // Step 1: identity
    fireEvent.change(screen.getByLabelText(/email di contatto privacy/i), {
      target: { value: 'privacy@example.com' },
    });
    fireEvent.click(screen.getByRole('button', { name: /avanti/i }));

    // Step 2: usage — accept the pre-filled defaults
    await screen.findByText('Google Analytics');
    fireEvent.click(screen.getByRole('button', { name: /avanti/i }));

    // Step 3: documents — select Privacy Policy only, keep both locales
    await screen.findByText('Quali documenti generare');
    fireEvent.click(screen.getByRole('switch', { name: /privacy policy/i }));
    fireEvent.change(screen.getByLabelText(/giurisdizione competente/i), {
      target: { value: 'Italia' },
    });
    fireEvent.click(screen.getByRole('button', { name: /avanti/i }));

    // Step 4: review — preview loads, confirm, generate
    await waitFor(() => {
      expect(api.previewLegalDocuments).toHaveBeenCalledWith('site-1', {
        documents: ['privacy-policy'],
        locales: ['it', 'en'],
        answers: expect.objectContaining({
          contactEmail: 'privacy@example.com',
          jurisdictionCountry: 'Italia',
        }),
      });
    });
    expect(
      await screen.findByRole('button', { name: /privacy policy — it/i }),
    ).toBeTruthy();

    fireEvent.click(
      screen.getByRole('switch', { name: /ho capito che sono bozze/i }),
    );
    fireEvent.click(screen.getByRole('button', { name: /genera bozze/i }));

    expect(await screen.findByText(/bozze create/i)).toBeTruthy();
    expect(screen.getByRole('link', { name: /apri bozza/i })).toBeTruthy();
  });
});
