import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from '@tanstack/react-router';
import { Badge } from '../components/ui/badge.js';
import { Separator } from '../components/ui/separator.js';
import { LanguageSwitcher } from './language-switcher.js';
import { LogoutButton } from './logout-button.js';

export interface AdminShellProps {
  children: ReactNode;
}

interface DisabledNavItemProps {
  label: string;
}

function DisabledNavItem({ label }: DisabledNavItemProps) {
  const { t } = useTranslation();
  return (
    <span className="flex items-center justify-between rounded-md px-2 py-1.5 text-sm text-muted-foreground opacity-60">
      {label}
      <Badge variant="secondary">{t('shell.nav.comingSoon')}</Badge>
    </span>
  );
}

export function AdminShell({ children }: AdminShellProps) {
  const { t } = useTranslation();

  return (
    <div className="flex h-screen flex-col">
      <header className="flex items-center justify-between border-b px-4 py-2">
        <span className="text-sm font-semibold">Brisk</span>
        <div className="flex items-center gap-3">
          <LanguageSwitcher />
          <LogoutButton />
        </div>
      </header>
      <div className="flex min-h-0 flex-1">
        <nav className="flex w-48 shrink-0 flex-col gap-1 border-r p-3">
          <Link
            to="/pages"
            className="rounded-md px-2 py-1.5 text-sm font-medium hover:bg-muted"
          >
            {t('shell.nav.pages')}
          </Link>
          <Separator className="my-2" />
          <DisabledNavItem label={t('shell.nav.media')} />
          <DisabledNavItem label={t('shell.nav.users')} />
        </nav>
        <main className="flex-1 overflow-auto p-6">{children}</main>
      </div>
    </div>
  );
}
