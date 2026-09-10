import { useTranslation } from 'react-i18next';
import { CircleDot, GitFork } from 'lucide-react';
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
 *
 * Filled-means-published is a convention nobody is born knowing, and a
 * screen reader was being read the locale and nothing else, so each badge
 * also SAYS its state: "EN — Published".
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
        const label = (
          status:
            | 'pages.list.statusPublished'
            | 'pages.list.statusDraft'
            | 'pages.list.statusPending'
            | 'pages.list.statusMissing',
        ) => `${locale.toUpperCase()} — ${t(status)}`;
        if (!translation) {
          return (
            <Badge
              key={locale}
              variant="outline"
              className="text-muted-foreground opacity-60"
              title={label('pages.list.statusMissing')}
              aria-label={label('pages.list.statusMissing')}
            >
              <span className="uppercase">{locale}</span>
            </Badge>
          );
        }
        // A published page whose draft has moved on is neither of the two
        // states the fill was showing. It is the one that costs somebody
        // something — what is online is not what they last wrote — so it
        // gets its own word and its own mark.
        const status = !(translation.status === 'published')
          ? ('pages.list.statusDraft' as const)
          : translation.hasUnpublishedChanges
            ? ('pages.list.statusPending' as const)
            : ('pages.list.statusPublished' as const);
        return (
          <Badge
            key={locale}
            variant={translation.status === 'published' ? 'default' : 'outline'}
            className={
              translation.hasUnpublishedChanges
                ? 'bg-amber-500 text-amber-950 hover:bg-amber-500'
                : undefined
            }
            title={label(status)}
            aria-label={label(status)}
          >
            <span className="uppercase">{locale}</span>
            {translation.hasUnpublishedChanges && <CircleDot size={10} />}
            {translation.isDiverged && (
              <GitFork size={10} aria-label={t('canvas.language.diverged')} />
            )}
          </Badge>
        );
      })}
    </div>
  );
}
