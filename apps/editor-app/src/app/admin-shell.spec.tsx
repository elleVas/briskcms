import type { ReactNode } from 'react';
import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import * as router from '@tanstack/react-router';
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

describe('AdminShell', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('renders a link to Pagine, disabled placeholders for Media/Utenti, and a logout control', () => {
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
    expect(screen.getByRole('button', { name: /^esci$/i })).toBeTruthy();
    expect(screen.getByText('content')).toBeTruthy();
  });
});
