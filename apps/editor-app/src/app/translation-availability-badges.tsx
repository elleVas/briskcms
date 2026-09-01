import { useTranslation } from 'react-i18next';
import { GitFork } from 'lucide-react';
import type { PageGroupListItemTranslation } from '@brisk/shared-types';
import { Badge } from '../components/ui/badge';

export interface TranslationAvailabilityBadgesProps {
  translations: PageGroupListItemTranslation[];
  /** Every locale the site offers, in display order — a locale with no matching translation still gets a (muted) "missing" badge. */
  enabledLocales: string[];
}

/**
 * Fase 4's pages-list row summary — one badge per site locale: published
 * (filled), draft (outlined), diverged (adds a GitFork mark, same icon as
 * canvas/language-switcher.tsx's own), or missing (muted, no translation
 * at all yet). No existing "row of per-locale status badges" component to
 * copy (closest analogs — language-switcher.tsx, page-translations-dialog.tsx
 * — are both single-purpose, not list-row summaries, see the plan).
 */
export function TranslationAvailabilityBadges({
  translations,
  enabledLocales,
}: TranslationAvailabilityBadgesProps) {
  const { t } = useTranslation();

  return (
    <div className="flex flex-wrap gap-1">
      {enabledLocales.map((locale) => {
        const translation = translations.find((tr) => tr.locale === locale);
        if (!translation) {
          return (
            <Badge
              key={locale}
              variant="outline"
              className="text-muted-foreground opacity-60"
            >
              <span className="uppercase">{locale}</span>
            </Badge>
          );
        }
        return (
          <Badge
            key={locale}
            variant={translation.status === 'published' ? 'default' : 'outline'}
          >
            <span className="uppercase">{locale}</span>
            {translation.isDiverged && (
              <GitFork size={10} aria-label={t('canvas.language.diverged')} />
            )}
          </Badge>
        );
      })}
    </div>
  );
}
