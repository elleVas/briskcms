import type { ReactNode } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import * as router from '@tanstack/react-router';
import * as authApi from '../lib/auth-api-client.js';
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

vi.mock('../lib/auth-api-client.js', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('../lib/auth-api-client.js')>();
  return { ...actual, logout: vi.fn() };
});

describe('AdminShell', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('renders a link to Pagine and disabled placeholders for Media/Utenti', () => {
    vi.mocked(router.useNavigate).mockReturnValue(vi.fn());

    render(
      <AdminShell>
        <p>content</p>
      </AdminShell>,
    );

    expect(
      screen.getByRole('link', { name: 'Pagine' }).getAttribute('href'),
    ).toBe('/pages');
    expect(screen.getByText('Media')).toBeTruthy();
    expect(screen.getByText('Utenti')).toBeTruthy();
    expect(screen.getAllByText('In arrivo')).toHaveLength(2);
    expect(screen.getByText('content')).toBeTruthy();
  });

  it('logs out and navigates to /login when Esci is clicked', async () => {
    const navigate = vi.fn();
    vi.mocked(router.useNavigate).mockReturnValue(navigate);
    vi.mocked(authApi.logout).mockResolvedValue({ success: true });

    render(
      <AdminShell>
        <p>content</p>
      </AdminShell>,
    );
    fireEvent.click(screen.getByRole('button', { name: /^esci$/i }));

    await waitFor(() => expect(authApi.logout).toHaveBeenCalled());
    expect(navigate).toHaveBeenCalledWith({ to: '/login' });
  });
});
