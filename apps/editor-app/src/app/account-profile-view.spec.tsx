import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { QueryClientProvider } from '@tanstack/react-query';
import type { AccountProfile } from '@brisk/shared-types';
import { createTestQueryClient } from '../test/query-client.test-fixture';
import * as accountApi from '../lib/account-api-client';
import { ApiError } from '../lib/http-client';
import { PUBLIC_SITE_URL } from '../lib/public-site-url';
import { AccountProfileView } from './account-profile-view';

vi.mock('../lib/account-api-client', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('../lib/account-api-client')>();
  return {
    ...actual,
    updateAccountProfile: vi.fn(),
    uploadAccountAvatar: vi.fn(),
    removeAccountAvatar: vi.fn(),
  };
});

const profile: AccountProfile = {
  id: 'user-1',
  email: 'giulia@example.com',
  role: 'editor',
  displayName: 'Giulia Rossi',
  slug: 'giulia-rossi',
  // French is not a language the site publishes any more.
  bio: { it: 'Scrive di caffè.', fr: 'Écrit sur le café.' },
  avatarUrl: 'https://cdn.test/giulia.webp',
};

function renderView(overrides: Partial<AccountProfile> = {}) {
  return render(
    <QueryClientProvider client={createTestQueryClient()}>
      <AccountProfileView
        profile={{ ...profile, ...overrides }}
        locales={['it', 'en']}
      />
    </QueryClientProvider>,
  );
}

describe('AccountProfileView', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('asks for a bio in each language the site publishes, and shows email and role without editing them', () => {
    renderView();

    expect(
      (screen.getByLabelText('italiano') as HTMLTextAreaElement).value,
    ).toBe('Scrive di caffè.');
    expect(
      (screen.getByLabelText('inglese') as HTMLTextAreaElement).value,
    ).toBe('');
    expect(screen.queryByLabelText('francese')).toBeNull();
    expect(screen.getByText('giulia@example.com').tagName).toBe('DD');
    expect(screen.getByText('Editor').tagName).toBe('DD');
  });

  it('shows the author page address in each language, under that language’s word', () => {
    renderView();

    expect(
      screen.getByText(`${PUBLIC_SITE_URL}/it/autore/giulia-rossi`),
    ).toBeTruthy();
    expect(
      screen.getByText(`${PUBLIC_SITE_URL}/en/author/giulia-rossi`),
    ).toBeTruthy();
  });

  it('previews the address made from the name for someone who has none yet', () => {
    renderView({ displayName: null, slug: null });

    fireEvent.change(screen.getByLabelText('Nome'), {
      target: { value: 'Luca Verdì' },
    });

    expect(
      screen.getByText(`${PUBLIC_SITE_URL}/it/autore/luca-verdi`),
    ).toBeTruthy();
  });

  it('saves the name, the address and the bio — keeping what was written in a language switched off', async () => {
    vi.mocked(accountApi.updateAccountProfile).mockResolvedValue(profile);
    renderView();

    fireEvent.change(screen.getByLabelText('inglese'), {
      target: { value: 'Writes about coffee.' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Salva' }));

    await screen.findByRole('status');
    expect(accountApi.updateAccountProfile).toHaveBeenCalledWith({
      displayName: 'Giulia Rossi',
      slug: 'giulia-rossi',
      bio: {
        it: 'Scrive di caffè.',
        en: 'Writes about coffee.',
        fr: 'Écrit sur le café.',
      },
    });
  });

  it('writes a typed address the way an address is written, on leaving the field', () => {
    renderView();
    const field = screen.getByLabelText('Indirizzo della pagina autore');

    fireEvent.change(field, { target: { value: 'Giulia Rossì Blog' } });
    fireEvent.blur(field);

    expect((field as HTMLInputElement).value).toBe('giulia-rossi-blog');
  });

  it('writes the address the way an address is written when saved straight after typing', async () => {
    vi.mocked(accountApi.updateAccountProfile).mockResolvedValue(profile);
    renderView();

    fireEvent.change(screen.getByLabelText('Indirizzo della pagina autore'), {
      target: { value: 'Giulia Rossì Blog' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Salva' }));

    await screen.findByRole('status');
    expect(accountApi.updateAccountProfile).toHaveBeenCalledWith(
      expect.objectContaining({ slug: 'giulia-rossi-blog' }),
    );
  });

  it('previews the address they keep when the field is emptied', () => {
    renderView();

    fireEvent.change(screen.getByLabelText('Indirizzo della pagina autore'), {
      target: { value: '' },
    });

    expect(
      screen.getByText(`${PUBLIC_SITE_URL}/it/autore/giulia-rossi`),
    ).toBeTruthy();
  });

  it('says so when someone else already has the address', async () => {
    vi.mocked(accountApi.updateAccountProfile).mockRejectedValue(
      new ApiError(409, { message: 'taken' }),
    );
    renderView();

    fireEvent.click(screen.getByRole('button', { name: 'Salva' }));

    expect(
      await screen.findByText(
        'Questo indirizzo è già usato da un’altra persona. Scegline un altro.',
      ),
    ).toBeTruthy();
    expect(
      screen
        .getByLabelText('Indirizzo della pagina autore')
        .getAttribute('aria-invalid'),
    ).toBe('true');
  });

  it('explains a file that is not a picture, and removes the picture on request', async () => {
    vi.mocked(accountApi.uploadAccountAvatar).mockRejectedValue(
      new ApiError(400, { message: 'not an image' }),
    );
    vi.mocked(accountApi.removeAccountAvatar).mockResolvedValue({
      ...profile,
      avatarUrl: null,
    });
    const { container } = renderView();
    const input = container.querySelector('input[type="file"]');
    if (!input) throw new Error('no file input');

    fireEvent.change(input, {
      target: {
        files: [new File(['<svg/>'], 'me.svg', { type: 'image/svg+xml' })],
      },
    });
    expect(
      await screen.findByText(
        'Questo file non è un’immagine. Scegli un JPG, PNG, WebP, GIF o AVIF.',
      ),
    ).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Rimuovi' }));
    await waitFor(() =>
      expect(accountApi.removeAccountAvatar).toHaveBeenCalled(),
    );
  });
});
