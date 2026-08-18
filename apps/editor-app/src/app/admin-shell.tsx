import type { ReactNode } from 'react';
import { Link } from '@tanstack/react-router';
import { Badge } from '../components/ui/badge.js';
import { Separator } from '../components/ui/separator.js';
import { LogoutButton } from './logout-button.js';

export interface AdminShellProps {
  children: ReactNode;
}

export function AdminShell({ children }: AdminShellProps) {
  return (
    <div className="flex h-screen flex-col">
      <header className="flex items-center justify-between border-b px-4 py-2">
        <span className="text-sm font-semibold">Brisk</span>
        <LogoutButton />
      </header>
      <div className="flex min-h-0 flex-1">
        <nav className="flex w-48 shrink-0 flex-col gap-1 border-r p-3">
          <Link
            to="/pages"
            className="rounded-md px-2 py-1.5 text-sm font-medium hover:bg-muted"
          >
            Pagine
          </Link>
          <Separator className="my-2" />
          <span className="flex items-center justify-between rounded-md px-2 py-1.5 text-sm text-muted-foreground opacity-60">
            Media
            <Badge variant="secondary">In arrivo</Badge>
          </span>
          <span className="flex items-center justify-between rounded-md px-2 py-1.5 text-sm text-muted-foreground opacity-60">
            Utenti
            <Badge variant="secondary">In arrivo</Badge>
          </span>
        </nav>
        <main className="flex-1 overflow-auto p-6">{children}</main>
      </div>
    </div>
  );
}
