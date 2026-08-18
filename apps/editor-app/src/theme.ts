export type Theme = 'light' | 'dark';

const STORAGE_KEY = 'brisk-theme';

// No system-preference detection, same reasoning as i18n's explicit `lng`:
// a fixed default keeps first paint deterministic — the toggle in the
// account menu (see app/account-menu.tsx) is how it actually changes.
// Dark is the default on first visit (no stored preference yet).
export function getInitialTheme(): Theme {
  return localStorage.getItem(STORAGE_KEY) === 'light' ? 'light' : 'dark';
}

export function applyTheme(theme: Theme): void {
  document.documentElement.classList.toggle('dark', theme === 'dark');
  localStorage.setItem(STORAGE_KEY, theme);
}
