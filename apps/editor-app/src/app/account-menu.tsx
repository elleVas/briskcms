import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { LogOut, UserRound } from 'lucide-react';
import { Button } from '../components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '../components/ui/popover';
import { accountProfileQueryOptions } from './account-queries';
import { UserAvatar } from './user-avatar';
import { useSession } from './use-session';

/**
 * Who is signed in, at the foot of the sidebar: their picture (or initial)
 * and name, and behind it their profile and the way out.
 *
 * Separate from SettingsMenu, which is about the application (language,
 * theme); this is about the person.
 */
export function AccountMenu() {
  const { t } = useTranslation();
  const { handleLogout } = useSession();
  const [open, setOpen] = useState(false);
  // Not suspending: the sidebar is on screen before the profile is known,
  // and it must not wait for it.
  const { data: profile } = useQuery(accountProfileQueryOptions());

  const name = profile?.displayName?.trim() || profile?.email || '';

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          className="h-auto w-full justify-start gap-2 px-2 py-1.5 text-sm font-medium"
          // What the button is, then whose: the name alone would not say
          // that a menu opens behind it.
          aria-label={
            name
              ? t('shell.account.menuLabel', { name })
              : t('shell.account.label')
          }
        >
          {profile ? (
            <UserAvatar
              seed={profile.id}
              name={name}
              imageUrl={profile.avatarUrl}
              size="sm"
            />
          ) : (
            <UserRound className="size-4" />
          )}
          <span className="flex min-w-0 flex-col items-start">
            <span className="w-full truncate text-start">
              {name || t('shell.account.label')}
            </span>
            {profile && (
              <span className="text-xs font-normal text-muted-foreground">
                {t(`users.role.${profile.role}`)}
              </span>
            )}
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent side="top" align="start" className="w-60 p-1">
        {profile && (
          <p className="truncate px-2 py-1.5 text-xs text-muted-foreground">
            {profile.email}
          </p>
        )}
        <Button
          asChild
          variant="ghost"
          className="w-full justify-start gap-2 px-2"
        >
          <Link to="/account" onClick={() => setOpen(false)}>
            <UserRound className="size-4" />
            {t('shell.account.profile')}
          </Link>
        </Button>
        <Button
          variant="ghost"
          className="w-full justify-start gap-2 px-2"
          onClick={() => void handleLogout()}
        >
          <LogOut className="size-4" />
          {t('auth.logout')}
        </Button>
      </PopoverContent>
    </Popover>
  );
}
