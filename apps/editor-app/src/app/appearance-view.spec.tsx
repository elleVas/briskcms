import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AppearanceView } from './appearance-view.js';

vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@tanstack/react-router')>();
  return {
    ...actual,
    Link: ({
      children,
      to,
      search,
      className,
    }: {
      children: React.ReactNode;
      to: string;
      search?: { locale?: string };
      className?: string;
    }) => (
      <a
        href={`${to}${search?.locale ? `?locale=${search.locale}` : ''}`}
        className={className}
      >
        {children}
      </a>
    ),
  };
});

describe('AppearanceView', () => {
  it('links to the Header and Footer editors for the current locale', () => {
    render(<AppearanceView enabledLocales={['it']} locale="it" />);

    const headerLink = screen.getByRole('link', { name: /modifica header/i });
    expect(headerLink.getAttribute('href')).toBe(
      '/appearance/header?locale=it',
    );
    const footerLink = screen.getByRole('link', { name: /modifica footer/i });
    expect(footerLink.getAttribute('href')).toBe(
      '/appearance/footer?locale=it',
    );
  });

  it('hides the locale switcher for a single-locale site', () => {
    render(<AppearanceView enabledLocales={['it']} locale="it" />);

    expect(screen.queryByText('IT')).toBeNull();
  });

  it('shows a locale switcher once the site has more than one locale', () => {
    render(<AppearanceView enabledLocales={['it', 'en']} locale="it" />);

    expect(screen.getByText('IT')).toBeTruthy();
    expect(screen.getByText('EN')).toBeTruthy();
  });

  it('points the Header/Footer links at the currently selected locale', () => {
    render(<AppearanceView enabledLocales={['it', 'en']} locale="en" />);

    const headerLink = screen.getByRole('link', { name: /modifica header/i });
    expect(headerLink.getAttribute('href')).toBe(
      '/appearance/header?locale=en',
    );
  });
});
