import { useTranslation } from 'react-i18next';
import { Link } from '@tanstack/react-router';
import { PanelBottom, PanelTop } from 'lucide-react';
import { Badge } from '../components/ui/badge.js';
import { cn } from '../lib/utils.js';

export interface LayoutViewProps {
  enabledLocales: string[];
  locale: string;
}

/**
 * Entry point for Header/Footer (docs/adr/0018) — a locale switcher (only
 * shown once the site actually has more than one locale, same threshold
 * LocaleListEditor implies) plus two cards linking into the fullscreen
 * Puck editor for each. No "create" step: getOrCreateSiteLayoutSection
 * means the editor is always ready the moment you land on it.
 *
 * Named "Layout" (not "Aspetto"/"Appearance") — that name never fit, this
 * section only ever managed Header/Footer structure, never colors/fonts/
 * general site look, which is what the separate "Style" section
 * (style-view.tsx, docs/adr/0021) actually owns.
 */
export function LayoutView({ enabledLocales, locale }: LayoutViewProps) {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-lg font-semibold">{t('layout.title')}</h1>
      {enabledLocales.length > 1 && (
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">
            {t('layout.localeLabel')}
          </span>
          {enabledLocales.map((loc) => (
            <Link
              key={loc}
              to="/layout"
              search={{ locale: loc }}
              className={cn('inline-flex', loc === locale && 'font-semibold')}
            >
              <Badge variant={loc === locale ? 'default' : 'outline'}>
                {loc.toUpperCase()}
              </Badge>
            </Link>
          ))}
        </div>
      )}
      <div className="grid max-w-md gap-3">
        <Link
          to="/layout/header"
          search={{ locale }}
          className="flex items-center gap-3 rounded-md border p-4 hover:bg-muted"
        >
          <PanelTop className="size-5" />
          <div className="flex flex-col">
            <span className="text-sm font-medium">
              {t('layout.editHeader')}
            </span>
            <span className="text-xs text-muted-foreground">
              {t('layout.editHeaderDescription')}
            </span>
          </div>
        </Link>
        <Link
          to="/layout/footer"
          search={{ locale }}
          className="flex items-center gap-3 rounded-md border p-4 hover:bg-muted"
        >
          <PanelBottom className="size-5" />
          <div className="flex flex-col">
            <span className="text-sm font-medium">
              {t('layout.editFooter')}
            </span>
            <span className="text-xs text-muted-foreground">
              {t('layout.editFooterDescription')}
            </span>
          </div>
        </Link>
      </div>
    </div>
  );
}
