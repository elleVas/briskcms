import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { LanguageSwitcher } from './language-switcher.js';

describe('LanguageSwitcher', () => {
  it('marks the active language as pressed', () => {
    render(<LanguageSwitcher />);

    expect(screen.getByRole('button', { name: 'IT' })).toHaveProperty(
      'ariaPressed',
      'true',
    );
    expect(screen.getByRole('button', { name: 'EN' })).toHaveProperty(
      'ariaPressed',
      'false',
    );
  });

  it('switches the active language when clicked', () => {
    render(<LanguageSwitcher />);

    fireEvent.click(screen.getByRole('button', { name: 'EN' }));

    expect(screen.getByRole('button', { name: 'EN' })).toHaveProperty(
      'ariaPressed',
      'true',
    );
    expect(screen.getByRole('button', { name: 'IT' })).toHaveProperty(
      'ariaPressed',
      'false',
    );
  });
});
