import { useTranslation } from 'react-i18next';
import { User } from 'lucide-react';
import { Button } from '../components/ui/button.js';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '../components/ui/popover.js';
import { useSession } from './use-session.js';

// Just logout for now — room for real profile settings later, separate
// from SettingsMenu (language/theme), which is app-level, not account-level.
export function AccountMenu() {
  const { t } = useTranslation();
  const { handleLogout } = useSession();

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          className="w-full justify-start gap-2 px-2 py-1.5 text-sm font-medium"
        >
          <User className="size-4" />
          {t('shell.account.label')}
        </Button>
      </PopoverTrigger>
      <PopoverContent side="top" align="start" className="w-56">
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
