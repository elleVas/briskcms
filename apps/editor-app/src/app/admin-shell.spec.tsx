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

  it('renders links to Pagine, Media, Aspetto and Utenti, and separate Impostazioni/Account menus', () => {
    vi.mocked(router.useNavigate).mockReturnValue(vi.fn());

    renderShell();

    expect(
      screen.getByRole('link', { name: 'Pagine' }).getAttribute('href'),
    ).toBe('/pages');
    expect(
      screen.getByRole('link', { name: 'Media' }).getAttribute('href'),
    ).toBe('/media');
    expect(
      screen.getByRole('link', { name: 'Aspetto' }).getAttribute('href'),
    ).toBe('/appearance');
    expect(
      screen.getByRole('link', { name: 'Utenti' }).getAttribute('href'),
    ).toBe('/users');
    expect(screen.getByText('content')).toBeTruthy();
    expect(
      screen.getByRole('button', { name: /^impostazioni$/i }),
    ).toBeTruthy();
    expect(screen.getByRole('button', { name: /^account$/i })).toBeTruthy();
  });

  it('exposes the language/theme toggles inside Impostazioni', () => {
    vi.mocked(router.useNavigate).mockReturnValue(vi.fn());

    renderShell();
    fireEvent.click(screen.getByRole('button', { name: /^impostazioni$/i }));

    expect(screen.getByRole('switch', { name: /lingua/i })).toBeTruthy();
    expect(screen.getByRole('switch', { name: /tema scuro/i })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /^esci$/i })).toBeNull();
  });

  it('exposes logout inside Account', () => {
    vi.mocked(router.useNavigate).mockReturnValue(vi.fn());

    renderShell();
    fireEvent.click(screen.getByRole('button', { name: /^account$/i }));

    expect(screen.getByRole('button', { name: /^esci$/i })).toBeTruthy();
    expect(screen.queryByRole('switch', { name: /lingua/i })).toBeNull();
  });
});
