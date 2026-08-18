import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { applyTheme, getInitialTheme } from './theme.js';

describe('theme', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove('dark');
  });

  afterEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove('dark');
  });

  it('defaults to dark when nothing is stored yet', () => {
    expect(getInitialTheme()).toBe('dark');
  });

  it('honors a stored light preference', () => {
    localStorage.setItem('brisk-theme', 'light');
    expect(getInitialTheme()).toBe('light');
  });

  it('honors a stored dark preference', () => {
    localStorage.setItem('brisk-theme', 'dark');
    expect(getInitialTheme()).toBe('dark');
  });

  it('applyTheme toggles the html.dark class and persists the choice', () => {
    applyTheme('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(localStorage.getItem('brisk-theme')).toBe('dark');

    applyTheme('light');
    expect(document.documentElement.classList.contains('dark')).toBe(false);
    expect(localStorage.getItem('brisk-theme')).toBe('light');
  });
});
