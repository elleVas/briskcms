import type { ComponentType, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from '@tanstack/react-router';
import { FileText, Image, Users } from 'lucide-react';
import { AccountMenu } from './account-menu.js';
import { Badge } from '../components/ui/badge.js';
import { Separator } from '../components/ui/separator.js';

export interface AdminShellProps {
  children: ReactNode;
}

interface DisabledNavItemProps {
  label: string;
  icon: ComponentType<{ className?: string }>;
}

function DisabledNavItem({ label, icon: Icon }: DisabledNavItemProps) {
  const { t } = useTranslation();
  return (
    <span className="flex items-center justify-between rounded-md px-2 py-1.5 text-sm text-muted-foreground opacity-60">
      <span className="flex items-center gap-2">
        <Icon className="size-4" />
        {label}
      </span>
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
      </header>
      <div className="flex min-h-0 flex-1">
        <nav className="flex w-48 shrink-0 flex-col border-r p-3">
          <div className="flex flex-1 flex-col gap-1">
            <Link
              to="/pages"
              className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm font-medium hover:bg-muted"
            >
              <FileText className="size-4" />
              {t('shell.nav.pages')}
            </Link>
            <Separator className="my-2" />
            <DisabledNavItem label={t('shell.nav.media')} icon={Image} />
            <DisabledNavItem label={t('shell.nav.users')} icon={Users} />
          </div>
          <AccountMenu />
        </nav>
        <main className="flex-1 overflow-auto p-6">{children}</main>
      </div>
    </div>
  );
}
