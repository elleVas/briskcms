import type { ReactNode } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { QueryClientProvider } from '@tanstack/react-query';
import * as router from '@tanstack/react-router';
import { createTestQueryClient } from '../test-query-client.js';
import { AdminShell } from './admin-shell.js';

vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@tanstack/react-router')>();
  return {
    ...actual,
    Link: ({
      children,
      to,
      className,
    }: {
      children: ReactNode;
      to: string;
      className?: string;
    }) => (
      <a href={to} className={className}>
        {children}
      </a>
    ),
    useNavigate: vi.fn(),
  };
});

function renderShell() {
  return render(
    <QueryClientProvider client={createTestQueryClient()}>
      <AdminShell>
        <p>content</p>
      </AdminShell>
    </QueryClientProvider>,
  );
}

describe('AdminShell', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('renders a link to Pagine, disabled placeholders for Media/Utenti, and an account menu', () => {
    vi.mocked(router.useNavigate).mockReturnValue(vi.fn());

    renderShell();

    expect(
      screen.getByRole('link', { name: 'Pagine' }).getAttribute('href'),
    ).toBe('/pages');
    expect(screen.getByText('Media')).toBeTruthy();
    expect(screen.getByText('Utenti')).toBeTruthy();
    expect(screen.getAllByText('In arrivo')).toHaveLength(2);
    expect(screen.getByText('content')).toBeTruthy();
    expect(
      screen.getByRole('button', { name: /impostazioni account/i }),
    ).toBeTruthy();
  });

  it('exposes logout and the language/theme toggles inside the account menu', () => {
    vi.mocked(router.useNavigate).mockReturnValue(vi.fn());

    renderShell();
    fireEvent.click(
      screen.getByRole('button', { name: /impostazioni account/i }),
    );

    expect(screen.getByRole('button', { name: /^esci$/i })).toBeTruthy();
    expect(screen.getByRole('switch', { name: /lingua/i })).toBeTruthy();
    expect(screen.getByRole('switch', { name: /tema scuro/i })).toBeTruthy();
  });
});
