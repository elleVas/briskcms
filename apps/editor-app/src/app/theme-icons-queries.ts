import { queryOptions } from '@tanstack/react-query';
import { fetchThemeIcons } from '../lib/theme-api-client';

/**
 * Il set di icone di UN tema non cambia mai a runtime (i file del tema
 * sono nell'immagine) — `staleTime: Infinity` così una sola fetch per
 * tema per sessione basta (docs/adr/0023), niente refetch a ogni
 * apertura del picker. Da docs/adr/0042 la chiave include `themeName`:
 * cambiare tema al sito è una chiave diversa, quindi un refetch
 * automatico, non una cache stantia. `enabled` finché il tema non è
 * noto: meglio nessun dato che quello del tema sbagliato.
 */
export function themeIconsQueryOptions(themeName: string) {
  return queryOptions({
    queryKey: ['theme-icons', themeName] as const,
    queryFn: () => fetchThemeIcons(themeName),
    enabled: themeName !== '',
    staleTime: Infinity,
  });
}
