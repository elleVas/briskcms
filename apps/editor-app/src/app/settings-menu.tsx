import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  Building2,
  Clock,
  FolderTree,
  Globe,
  Languages,
  Monitor,
  Moon,
  Search,
  Settings,
  Sun,
} from 'lucide-react';
import { Button } from '../components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '../components/ui/popover';
import { Separator } from '../components/ui/separator';
import { Switch } from '../components/ui/switch';
import { BusinessInfoDialog } from './business-info-dialog';
import { CollectionsDialog } from './collections-dialog';
import { FormSubmissionRetentionDialog } from './form-submission-retention-dialog';
import { GeneralSettingsDialog } from './general-settings-dialog';
import { LocaleSettingsDialog } from './locale-settings-dialog';
import { SeoSettingsDialog } from './seo-settings-dialog';
import { siteQueryOptions } from './site-queries';
import { useTheme } from './use-theme';
import { cn } from '../lib/utils';
import type { Theme } from '../theme';

const THEME_CHOICES: readonly {
  value: Theme;
  icon: typeof Sun;
  labelKey:
    | 'shell.settings.themeLight'
    | 'shell.settings.themeDark'
    | 'shell.settings.themeSystem';
}[] = [
  { value: 'light', icon: Sun, labelKey: 'shell.settings.themeLight' },
  { value: 'dark', icon: Moon, labelKey: 'shell.settings.themeDark' },
  { value: 'system', icon: Monitor, labelKey: 'shell.settings.themeSystem' },
];

export function SettingsMenu() {
  const { t, i18n } = useTranslation();
  // Which site these dialogs edit is resolved at runtime now, so it can be
  // momentarily absent — in practice never, since every route under the
  // shell has already loaded this same entry. The dialogs below are simply
  // not mounted until it is there, which keeps `siteId` a required prop
  // that is always a real id, rather than an empty-string stand-in that
  // would reach the API as `PATCH /sites//...` if it ever did render.
  const { data: site } = useQuery(siteQueryOptions());
  const { theme, setTheme } = useTheme();
  const [isBusinessInfoOpen, setIsBusinessInfoOpen] = useState(false);
  const [isGeneralSettingsOpen, setIsGeneralSettingsOpen] = useState(false);
  const [isSeoSettingsOpen, setIsSeoSettingsOpen] = useState(false);
  const [isLocaleSettingsOpen, setIsLocaleSettingsOpen] = useState(false);
  const [isFormSubmissionRetentionOpen, setIsFormSubmissionRetentionOpen] =
    useState(false);
  const [isCollectionsOpen, setIsCollectionsOpen] = useState(false);

  return (
    <>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            className="w-full justify-start gap-2 px-2 py-1.5 text-sm font-medium"
          >
            <Settings className="size-4" />
            {t('shell.settings.label')}
          </Button>
        </PopoverTrigger>
        <PopoverContent side="top" align="start" className="w-56">
          <div className="flex items-center justify-between px-1 py-1 text-sm">
            <span className="text-muted-foreground">
              {t('shell.settings.language')}
            </span>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">IT</span>
              <Switch
                size="sm"
                checked={i18n.language === 'en'}
                onCheckedChange={(checked) =>
                  void i18n.changeLanguage(checked ? 'en' : 'it')
                }
                aria-label={t('shell.settings.language')}
              />
              <span className="text-xs text-muted-foreground">EN</span>
            </div>
          </div>
          {/* Three choices, not a switch: "follow the system" is now the
              default and a two-position toggle cannot express it. It used
              to be dark-or-light with dark forced on first visit, so
              somebody whose machine is light got a black editor and no way
              to say "just do what everything else does". */}
          <div className="flex items-center justify-between px-1 py-1 text-sm">
            <span className="text-muted-foreground">
              {t('shell.settings.theme')}
            </span>
            <div
              role="radiogroup"
              aria-label={t('shell.settings.theme')}
              className="flex items-center gap-0.5 rounded-md border p-0.5"
            >
              {THEME_CHOICES.map(({ value, icon: Icon, labelKey }) => (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={theme === value}
                  aria-label={t(labelKey)}
                  title={t(labelKey)}
                  onClick={() => setTheme(value)}
                  className={cn(
                    'flex size-6 items-center justify-center rounded-md text-muted-foreground hover:text-foreground',
                    theme === value && 'bg-muted text-foreground',
                  )}
                >
                  <Icon className="size-3.5" />
                </button>
              ))}
            </div>
          </div>
          <Separator className="my-1" />
          <Button
            variant="ghost"
            className="w-full justify-start gap-2 px-1 py-1.5 text-sm"
            onClick={() => setIsGeneralSettingsOpen(true)}
          >
            <Globe className="size-4" />
            {t('generalSettings.menuLabel')}
          </Button>
          <Button
            variant="ghost"
            className="w-full justify-start gap-2 px-1 py-1.5 text-sm"
            onClick={() => setIsSeoSettingsOpen(true)}
          >
            <Search className="size-4" />
            {t('seoSettings.menuLabel')}
          </Button>
          <Button
            variant="ghost"
            className="w-full justify-start gap-2 px-1 py-1.5 text-sm"
            onClick={() => setIsLocaleSettingsOpen(true)}
          >
            <Languages className="size-4" />
            {t('localeSettings.menuLabel')}
          </Button>
          <Button
            variant="ghost"
            className="w-full justify-start gap-2 px-1 py-1.5 text-sm"
            onClick={() => setIsBusinessInfoOpen(true)}
          >
            <Building2 className="size-4" />
            {t('businessInfo.menuLabel')}
          </Button>
          <Button
            variant="ghost"
            className="w-full justify-start gap-2 px-1 py-1.5 text-sm"
            onClick={() => setIsCollectionsOpen(true)}
          >
            <FolderTree className="size-4" />
            {t('collections.menuLabel')}
          </Button>
          <Button
            variant="ghost"
            className="w-full justify-start gap-2 px-1 py-1.5 text-sm"
            onClick={() => setIsFormSubmissionRetentionOpen(true)}
          >
            <Clock className="size-4" />
            {t('formSubmissionRetention.menuLabel')}
          </Button>
        </PopoverContent>
      </Popover>
      {site && (
        <>
          <CollectionsDialog
            siteId={site.id}
            open={isCollectionsOpen}
            onOpenChange={setIsCollectionsOpen}
          />
          <GeneralSettingsDialog
            siteId={site.id}
            open={isGeneralSettingsOpen}
            onOpenChange={setIsGeneralSettingsOpen}
          />
          <SeoSettingsDialog
            siteId={site.id}
            open={isSeoSettingsOpen}
            onOpenChange={setIsSeoSettingsOpen}
          />
          <LocaleSettingsDialog
            siteId={site.id}
            open={isLocaleSettingsOpen}
            onOpenChange={setIsLocaleSettingsOpen}
          />
          <BusinessInfoDialog
            siteId={site.id}
            open={isBusinessInfoOpen}
            onOpenChange={setIsBusinessInfoOpen}
          />
          <FormSubmissionRetentionDialog
            siteId={site.id}
            open={isFormSubmissionRetentionOpen}
            onOpenChange={setIsFormSubmissionRetentionOpen}
          />
        </>
      )}
    </>
  );
}
