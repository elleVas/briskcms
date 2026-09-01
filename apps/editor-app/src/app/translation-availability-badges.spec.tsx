import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { TranslationAvailabilityBadges } from './translation-availability-badges';

describe('TranslationAvailabilityBadges', () => {
  it('shows a badge for every enabled locale, in order', () => {
    render(
      <TranslationAvailabilityBadges
        translations={[
          {
            locale: 'it',
            slug: 'home',
            title: 'home',
            status: 'published',
            isDiverged: false,
          },
        ]}
        enabledLocales={['it', 'en']}
      />,
    );

    expect(screen.getByText('it')).toBeTruthy();
    expect(screen.getByText('en')).toBeTruthy();
  });

  it('marks a locale with no translation as missing (muted)', () => {
    render(
      <TranslationAvailabilityBadges
        translations={[]}
        enabledLocales={['it']}
      />,
    );

    const badge = screen.getByText('it').closest('[data-slot="badge"]');
    expect(badge?.className).toContain('opacity-60');
  });

  it('marks a published translation with the filled (default) variant', () => {
    render(
      <TranslationAvailabilityBadges
        translations={[
          {
            locale: 'it',
            slug: 'home',
            title: 'home',
            status: 'published',
            isDiverged: false,
          },
        ]}
        enabledLocales={['it']}
      />,
    );

    const badge = screen.getByText('it').closest('[data-slot="badge"]');
    expect(badge?.getAttribute('data-variant')).toBe('default');
  });

  it('marks a draft translation with the outline variant', () => {
    render(
      <TranslationAvailabilityBadges
        translations={[
          {
            locale: 'it',
            slug: 'home',
            title: 'home',
            status: 'draft',
            isDiverged: false,
          },
        ]}
        enabledLocales={['it']}
      />,
    );

    const badge = screen.getByText('it').closest('[data-slot="badge"]');
    expect(badge?.getAttribute('data-variant')).toBe('outline');
  });

  it('shows the diverged mark only for a diverged translation', () => {
    render(
      <TranslationAvailabilityBadges
        translations={[
          {
            locale: 'it',
            slug: 'home',
            title: 'home',
            status: 'published',
            isDiverged: true,
          },
          {
            locale: 'en',
            slug: 'home-en',
            title: 'home-en',
            status: 'published',
            isDiverged: false,
          },
        ]}
        enabledLocales={['it', 'en']}
      />,
    );

    const itBadge = screen.getByText('it').closest('[data-slot="badge"]');
    const enBadge = screen.getByText('en').closest('[data-slot="badge"]');
    expect(itBadge?.querySelector('svg')).toBeTruthy();
    expect(enBadge?.querySelector('svg')).toBeNull();
  });
});
