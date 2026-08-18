import { useCallback, useState } from 'react';
import { applyTheme, getInitialTheme, type Theme } from '../theme.js';

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(getInitialTheme);

  const setTheme = useCallback((next: Theme) => {
    applyTheme(next);
    setThemeState(next);
  }, []);

  return { theme, setTheme };
}
