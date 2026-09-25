import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { LayoutView } from './layout-view';

vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@tanstack/react-router')>();
  return {
    ...actual,
    Link: (await import('../test/router-link.test-fixture')).StubLink,
  };
});

describe('LayoutView', () => {
  it('links to the Header and Footer editors for the current locale', () => {
    render(<LayoutView enabledLocales={['it']} locale="it" />);

    const headerLink = screen.getByRole('link', { name: /modifica header/i });
    expect(headerLink.getAttribute('href')).toBe('/layout/header?locale=it');
    const footerLink = screen.getByRole('link', { name: /modifica footer/i });
    expect(footerLink.getAttribute('href')).toBe('/layout/footer?locale=it');
  });

  it('hides the locale switcher for a single-locale site', () => {
    render(<LayoutView enabledLocales={['it']} locale="it" />);

    expect(screen.queryByText('IT')).toBeNull();
  });

  it('shows a locale switcher once the site has more than one locale', () => {
    render(<LayoutView enabledLocales={['it', 'en']} locale="it" />);

    expect(screen.getByText('IT')).toBeTruthy();
    expect(screen.getByText('EN')).toBeTruthy();
  });

  it('points the Header/Footer links at the currently selected locale', () => {
    render(<LayoutView enabledLocales={['it', 'en']} locale="en" />);

    const headerLink = screen.getByRole('link', { name: /modifica header/i });
    expect(headerLink.getAttribute('href')).toBe('/layout/header?locale=en');
  });
});
