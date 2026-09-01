import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from '@tanstack/react-router';
import {
  Cookie,
  FileText,
  FormInput,
  Image,
  LayoutDashboard,
  LayoutTemplate,
  Palette,
  Plug,
  Users,
} from 'lucide-react';
import { AccountMenu } from './account-menu';
import { SettingsMenu } from './settings-menu';
import { Separator } from '../components/ui/separator';

export interface AdminShellProps {
  children: ReactNode;
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
              to="/"
              className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm font-medium hover:bg-muted"
            >
              <LayoutDashboard className="size-4" />
              {t('shell.nav.dashboard')}
            </Link>
            <Link
              to="/pages"
              className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm font-medium hover:bg-muted"
            >
              <FileText className="size-4" />
              {t('shell.nav.pages')}
            </Link>
            <Link
              to="/media"
              className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm font-medium hover:bg-muted"
            >
              <Image className="size-4" />
              {t('shell.nav.media')}
            </Link>
            <Link
              to="/forms"
              className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm font-medium hover:bg-muted"
            >
              <FormInput className="size-4" />
              {t('shell.nav.forms')}
            </Link>
            <Link
              to="/layout"
              className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm font-medium hover:bg-muted"
            >
              <LayoutTemplate className="size-4" />
              {t('shell.nav.layout')}
            </Link>
            <Link
              to="/style"
              className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm font-medium hover:bg-muted"
            >
              <Palette className="size-4" />
              {t('shell.nav.style')}
            </Link>
            <Link
              to="/integrations"
              className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm font-medium hover:bg-muted"
            >
              <Plug className="size-4" />
              {t('shell.nav.integrations')}
            </Link>
            <Link
              to="/cookies"
              className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm font-medium hover:bg-muted"
            >
              <Cookie className="size-4" />
              {t('shell.nav.cookies')}
            </Link>
            <Separator className="my-2" />
            <Link
              to="/users"
              className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm font-medium hover:bg-muted"
            >
              <Users className="size-4" />
              {t('shell.nav.users')}
            </Link>
          </div>
          <div className="flex flex-col gap-1">
            <SettingsMenu />
            <AccountMenu />
          </div>
        </nav>
        <main className="flex-1 overflow-auto p-6">{children}</main>
      </div>
    </div>
  );
}
