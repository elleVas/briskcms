import { useTranslation } from 'react-i18next';
import { Moon, Settings, Sun } from 'lucide-react';
import { Button } from '../components/ui/button.js';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '../components/ui/popover.js';
import { Separator } from '../components/ui/separator.js';
import { Switch } from '../components/ui/switch.js';
import { useSession } from './use-session.js';
import { useTheme } from './use-theme.js';

// The gear icon here is deliberately the only account-related control in
// the shell (see AdminShell) — logout and the language/theme toggles used
// to be separate header buttons; this is where they now live, alongside
// room for real profile settings later.
export function AccountMenu() {
  const { t, i18n } = useTranslation();
  const { theme, setTheme } = useTheme();
  const { handleLogout } = useSession();

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          className="w-full justify-start gap-2 px-2 py-1.5 text-sm font-medium"
        >
          <Settings className="size-4" />
          {t('shell.account.settings')}
        </Button>
      </PopoverTrigger>
      <PopoverContent side="top" align="start" className="w-56">
        <div className="flex items-center justify-between px-1 py-1 text-sm">
          <span className="text-muted-foreground">
            {t('shell.account.language')}
          </span>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">IT</span>
            <Switch
              size="sm"
              checked={i18n.language === 'en'}
              onCheckedChange={(checked) =>
                void i18n.changeLanguage(checked ? 'en' : 'it')
              }
              aria-label={t('shell.account.language')}
            />
            <span className="text-xs text-muted-foreground">EN</span>
          </div>
        </div>
        <div className="flex items-center justify-between px-1 py-1 text-sm">
          <span className="text-muted-foreground">
            {t('shell.account.theme')}
          </span>
          <div className="flex items-center gap-2">
            <Sun className="size-3.5 text-muted-foreground" />
            <Switch
              size="sm"
              checked={theme === 'dark'}
              onCheckedChange={(checked) =>
                setTheme(checked ? 'dark' : 'light')
              }
              aria-label={t('shell.account.theme')}
            />
            <Moon className="size-3.5 text-muted-foreground" />
          </div>
        </div>
        <Separator className="my-1" />
        <Button
          variant="ghost"
          className="w-full justify-start px-1"
          onClick={() => void handleLogout()}
        >
          {t('auth.logout')}
        </Button>
      </PopoverContent>
    </Popover>
  );
}
