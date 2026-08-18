import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Building2, Moon, Settings, Sun } from 'lucide-react';
import { Button } from '../components/ui/button.js';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '../components/ui/popover.js';
import { Separator } from '../components/ui/separator.js';
import { Switch } from '../components/ui/switch.js';
import { BusinessInfoDialog } from './business-info-dialog.js';
import { useTheme } from './use-theme.js';

const DEFAULT_SITE_ID = import.meta.env['VITE_DEFAULT_SITE_ID'] as string;

export function SettingsMenu() {
  const { t, i18n } = useTranslation();
  const { theme, setTheme } = useTheme();
  const [isBusinessInfoOpen, setIsBusinessInfoOpen] = useState(false);

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
          <div className="flex items-center justify-between px-1 py-1 text-sm">
            <span className="text-muted-foreground">
              {t('shell.settings.theme')}
            </span>
            <div className="flex items-center gap-2">
              <Sun className="size-3.5 text-muted-foreground" />
              <Switch
                size="sm"
                checked={theme === 'dark'}
                onCheckedChange={(checked) =>
                  setTheme(checked ? 'dark' : 'light')
                }
                aria-label={t('shell.settings.theme')}
              />
              <Moon className="size-3.5 text-muted-foreground" />
            </div>
          </div>
          <Separator className="my-1" />
          <Button
            variant="ghost"
            className="w-full justify-start gap-2 px-1 py-1.5 text-sm"
            onClick={() => setIsBusinessInfoOpen(true)}
          >
            <Building2 className="size-4" />
            {t('businessInfo.menuLabel')}
          </Button>
        </PopoverContent>
      </Popover>
      <BusinessInfoDialog
        siteId={DEFAULT_SITE_ID}
        open={isBusinessInfoOpen}
        onOpenChange={setIsBusinessInfoOpen}
      />
    </>
  );
}
