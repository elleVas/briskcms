import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from '@tanstack/react-router';
import {
  ClipboardList,
  Cookie,
  FileText,
  Image,
  LayoutDashboard,
  LayoutList,
  PanelsTopLeft,
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
 * `data-status="active"` is the router's own answer, so "which one is
 * current" is read from the URL rather than tracked in state that can
 * disagree with it. `exact` for the dashboard alone: its path is `/`, a
 * prefix of every other route, so without it every screen would light up
 * the dashboard as well.
 *
 * It used to arrive as `activeProps.className`, which the router
 * CONCATENATES onto `className` — so the active link carried both
 * `text-muted-foreground` and `text-foreground`, and the order of two
 * class names inside one attribute decides nothing at all. Measured: the
 * active item and every inactive one computed to the same
 * `oklch(0.708 0 0)`, and only the background said where you were. A
 * variant instead of a second class: `[data-status="active"]` adds an
 * attribute selector to the class, so it wins on specificity rather than
 * on luck.
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
      className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background data-[status=active]:bg-muted data-[status=active]:text-foreground"
    >
      <Icon className="size-4" />
      {label}
    </Link>
  );
}

/**
 * A heading and the entries under it.
 *
 * `<ul>` under a heading rather than a run of links: the sidebar has
 * fifteen destinations in it, and a screen reader was being read them as
 * one undifferentiated list.
 */
function NavGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <h2 className="px-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </h2>
      {children}
    </div>
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
    <div className="flex h-screen">
      {/*
        The wordmark used to have a 37px bar of its own across the whole
        window, holding the single word "Brisk" at 14px — thirty-seven
        pixels of every screen spent on it, and the canvas editor already
        did without it. It sits at the top of the sidebar instead, where a
        product's name goes, and the "B" wears the accent so the app has a
        mark rather than a word.
      */}
      <nav className="flex w-52 shrink-0 flex-col gap-4 overflow-y-auto border-r border-sidebar-border bg-sidebar p-3 text-sidebar-foreground">
        <span className="flex items-center gap-2 px-2 pt-1 text-sm font-semibold">
          <span
            aria-hidden
            className="flex size-6 items-center justify-center rounded-md bg-primary text-sm font-bold text-primary-foreground"
          >
            B
          </span>
          Brisk
        </span>
        <div className="flex flex-1 flex-col gap-4">
          <NavItem
            to="/"
            icon={LayoutDashboard}
            label={t('shell.nav.dashboard')}
          />
          {/*
            Twelve flat entries, and a Settings menu holding six more, with
            no readable criterion between them: Style, Integrations and
            Cookie banner are settings and lived in the sidebar, while
            Languages and Business info are settings and lived in the menu.
            Three groups now, by what an entry is ABOUT — what the site
            says, what it looks like, and how it is set up.
          */}
          <NavGroup title={t('shell.nav.groupContent')}>
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
              icon={ClipboardList}
              label={t('shell.nav.forms')}
            />
          </NavGroup>
          <NavGroup title={t('shell.nav.groupSite')}>
            <NavItem
              to="/layout"
              icon={PanelsTopLeft}
              label={t('shell.nav.layout')}
            />
            <NavItem
              to="/sections"
              icon={LayoutList}
              label={t('shell.nav.sections')}
            />
            <NavItem
              to="/taxonomies"
              icon={Tags}
              label={t('shell.nav.taxonomies')}
            />
            <NavItem to="/style" icon={Palette} label={t('shell.nav.style')} />
          </NavGroup>
          <NavGroup title={t('shell.nav.groupSettings')}>
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
            {/* Admin-only, and the sidebar says so instead of the server
                saying it after the click. Every screen used to be offered
                to everybody: an Editor saw this, opened it, and got a
                generic error page — the API was right to refuse, the
                sidebar was wrong to ask. */}
            {isAdmin && (
              <NavItem to="/users" icon={Users} label={t('shell.nav.users')} />
            )}
            <SettingsMenu />
          </NavGroup>
        </div>
        <AccountMenu />
      </nav>
      <main className="flex-1 overflow-auto p-6">{children}</main>
    </div>
  );
}
