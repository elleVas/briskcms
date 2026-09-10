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
  Rows3,
  Tags,
  Palette,
  Plug,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { AccountMenu } from './account-menu';
import { collectionsQueryOptions } from './collections-queries';
import { collectionIcon } from './collection-icons';
import { siteQueryOptions } from './site-queries';
import { SettingsMenu } from './settings-menu';
import { Separator } from '../components/ui/separator';
import { useCurrentSession } from './use-current-session';

export interface AdminShellProps {
  children: ReactNode;
}

/**
 * One entry in the sidebar, and the only place its look is decided.
 *
 * The eleven links each carried the same class list and none of them
 * said which screen you were on: hovering told you what you were about
 * to click, and after the click nothing changed — the sidebar looked
 * identical on every page of the app.
 *
 * `activeProps` is the router's own answer, so "which one is current" is
 * read from the URL rather than tracked in state that can disagree with
 * it. `exact` for the dashboard alone: its path is `/`, a prefix of
 * every other route, so without it every screen would light up the
 * dashboard as well.
 */
function NavItem({
  to,
  params,
  icon: Icon,
  label,
}: {
  to: string;
  params?: Record<string, string>;
  icon: LucideIcon;
  label: string;
}) {
  return (
    <Link
      to={to}
      params={params}
      activeOptions={{ exact: to === '/' }}
      className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
      activeProps={{ className: 'bg-muted text-foreground' }}
    >
      <Icon className="size-4" />
      {label}
    </Link>
  );
}

export function AdminShell({ children }: AdminShellProps) {
  const { isAdmin } = useCurrentSession();
  const { t } = useTranslation();
  // A plain query, not a suspending one: the sidebar has to be on screen
  // before the sections it may or may not have are known, and a site with
  // none is the normal case.
  const { data: site } = useQuery(siteQueryOptions());
  const { data: collections } = useQuery({
    ...collectionsQueryOptions(site?.id ?? ''),
    enabled: Boolean(site?.id),
  });

  return (
    <div className="flex h-screen flex-col">
      <header className="flex items-center justify-between border-b px-4 py-2">
        <span className="text-sm font-semibold">Brisk</span>
      </header>
      <div className="flex min-h-0 flex-1">
        <nav className="flex w-48 shrink-0 flex-col border-r p-3">
          <div className="flex flex-1 flex-col gap-1">
            <NavItem
              to="/"
              icon={LayoutDashboard}
              label={t('shell.nav.dashboard')}
            />
            <NavItem to="/pages" icon={FileText} label={t('shell.nav.pages')} />
            {/* One entry per section the site has defined. They sit
                straight under Pages because that is what they are: pages
                of one kind, kept apart so neither list drowns the other. */}
            {(collections ?? []).map((collection) => (
              <NavItem
                key={collection.id}
                to="/collections/$collectionId"
                params={{ collectionId: collection.id }}
                icon={collectionIcon(collection.icon)}
                label={collection.name}
              />
            ))}
            <NavItem to="/media" icon={Image} label={t('shell.nav.media')} />
            <NavItem
              to="/forms"
              icon={FormInput}
              label={t('shell.nav.forms')}
            />
            <NavItem
              to="/layout"
              icon={LayoutTemplate}
              label={t('shell.nav.layout')}
            />
            <NavItem
              to="/sections"
              icon={Rows3}
              label={t('shell.nav.sections')}
            />
            <NavItem
              to="/taxonomies"
              icon={Tags}
              label={t('shell.nav.taxonomies')}
            />
            <NavItem to="/style" icon={Palette} label={t('shell.nav.style')} />
            <NavItem
              to="/integrations"
              icon={Plug}
              label={t('shell.nav.integrations')}
            />
            <NavItem
              to="/cookies"
              icon={Cookie}
              label={t('shell.nav.cookies')}
            />
            {/* Admin-only, and the sidebar now says so instead of the
                server saying it after the click. Every screen used to be
                offered to everybody: an Editor saw this, opened it, and
                got a generic error page — the API was right to refuse,
                the sidebar was wrong to ask. */}
            {isAdmin && (
              <>
                <Separator className="my-2" />
                <NavItem
                  to="/users"
                  icon={Users}
                  label={t('shell.nav.users')}
                />
              </>
            )}
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
