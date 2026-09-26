import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from '@tanstack/react-router';
import {
  ClipboardList,
  Cookie,
  FileText,
  Image,
  LayoutDashboard,
  LayoutList,
  Menu,
  PanelsTopLeft,
  Tags,
  Palette,
  Plug,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogTitle } from '../components/ui/dialog';
import { AccountMenu } from './account-menu';
import { IconButton } from './icon-button';
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
    // One entry, one list item — see NavGroup on why the group is a list.
    <li className="contents">
      <Link
        to={to}
        params={params}
        activeOptions={{ exact: to === '/' }}
        className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background data-[status=active]:bg-muted data-[status=active]:text-foreground"
      >
        <Icon className="size-4" />
        {label}
      </Link>
    </li>
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
      {/* A real list, not a run of links: the heading alone told a screen
          reader where a group started and nothing about how many
          destinations were in it. The `contents` display keeps the layout
          exactly as the flex column above draws it. */}
      <ul className="contents">{children}</ul>
    </div>
  );
}

/**
 * What the sidebar holds: the mark, the three groups, the account menu.
 *
 * Its own component because it is drawn in two places — the sidebar on a
 * wide screen, and the menu that slides in on a narrow one. One copy each
 * would be two navigations that could disagree about which screens exist.
 */
function SidebarContent() {
  const { isAdmin } = useCurrentSession();
  const { t } = useTranslation();
  // A plain query, not a suspending one: the sidebar has to be on screen
  // before the collections it may or may not have are known, and a site with
  // none is the normal case.
  const { data: site } = useQuery(siteQueryOptions());
  const { data: collections } = useQuery({
    ...collectionsQueryOptions(site?.id ?? ''),
    enabled: Boolean(site?.id),
  });

  return (
    <>
      <BriskMark />
      <div className="flex flex-1 flex-col gap-4">
        {/* A list of one, so the item is in a list: a list item on its own
            is announced as nothing at all. */}
        <ul className="contents">
          <NavItem
            to="/"
            icon={LayoutDashboard}
            label={t('shell.nav.dashboard')}
          />
        </ul>
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
          {/* One entry per collection the site has defined. They sit
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
          <NavItem to="/cookies" icon={Cookie} label={t('shell.nav.cookies')} />
          {/* The WordPress import is deliberately NOT offered here
              (ADR-0084). It works and it stays: `/imports` is still a
              route, still admin-only, and still reachable by typing the
              address — what it is missing is the half that writes, so a
              report is all it can give back. And a report saying what
              WOULD arrive is worth reading BEFORE choosing Brisk, which
              makes it material for the marketing site rather than a
              screen for somebody who has already signed up.

              To offer it again, put back an admin-only NavItem to
              "/imports" with the DownloadCloud icon and the
              `shell.nav.imports` label, beside Users below. */}
          {/* Admin-only, and the sidebar says so instead of the server
                saying it after the click. Every screen used to be offered
                to everybody: an Editor saw this, opened it, and got a
                generic error page — the API was right to refuse, the
                sidebar was wrong to ask. */}
          {isAdmin && (
            <NavItem to="/users" icon={Users} label={t('shell.nav.users')} />
          )}
          {/* Its own item, like every entry here: a list can only hold
              items, and a bare button inside it breaks the count a screen
              reader announces for the group. */}
          <li className="contents">
            <SettingsMenu />
          </li>
        </NavGroup>
      </div>
      <AccountMenu />
    </>
  );
}

/** The product's mark, which the sidebar and the narrow header both wear. */
function BriskMark() {
  return (
    <span className="flex items-center gap-2 px-2 pt-1 text-sm font-semibold">
      <span
        aria-hidden
        className="flex size-6 items-center justify-center rounded-md bg-primary text-sm font-bold text-primary-foreground"
      >
        B
      </span>
      Brisk
    </span>
  );
}

export function AdminShell({ children }: AdminShellProps) {
  const { t } = useTranslation();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="flex h-dvh flex-col md:flex-row">
      {/*
        The wordmark used to have a 37px bar of its own across the whole
        window, holding the single word "Brisk" at 14px — thirty-seven
        pixels of every screen spent on it, and the canvas editor already
        did without it. It sits at the top of the sidebar instead, where a
        product's name goes, and the "B" wears the accent so the app has a
        mark rather than a word.

        From `md` up only. Below that the sidebar was a fixed 208px column
        that took more than half of a 390px phone on every screen of the
        editor, leaving the page itself a strip. There it becomes a bar with
        the mark and a button, and the same navigation slides in on demand.
      */}
      <nav className="hidden w-52 shrink-0 flex-col gap-4 overflow-y-auto border-r border-sidebar-border bg-sidebar p-3 text-sidebar-foreground md:flex">
        <SidebarContent />
      </nav>
      <header className="flex h-12 shrink-0 items-center justify-between border-b border-sidebar-border bg-sidebar px-2 text-sidebar-foreground md:hidden">
        <BriskMark />
        <IconButton
          label={t('shell.menu.open')}
          onClick={() => setMenuOpen(true)}
        >
          <Menu />
        </IconButton>
      </header>
      <Dialog open={menuOpen} onOpenChange={setMenuOpen}>
        {/* A dialog, so focus is trapped in it, Escape and a tap outside
            close it, and the page behind is inert — everything a menu that
            covers the screen owes a keyboard and a screen reader. Anchored
            to the start edge instead of the centre. */}
        <DialogContent
          className="top-0 left-0 flex h-dvh w-72 max-w-[85vw] translate-x-0 translate-y-0 flex-col gap-4 overflow-y-auto rounded-none border-r border-sidebar-border bg-sidebar p-3 text-sidebar-foreground sm:max-w-72"
          // Following a link closes the menu: the screen it opens is the
          // thing the reader wanted to see, not the menu over it.
          onClick={(event) => {
            if (event.target instanceof Element && event.target.closest('a')) {
              setMenuOpen(false);
            }
          }}
        >
          <DialogTitle className="sr-only">{t('shell.menu.title')}</DialogTitle>
          <SidebarContent />
        </DialogContent>
      </Dialog>
      <main className="min-w-0 flex-1 overflow-auto p-4 md:p-6">
        {children}
      </main>
    </div>
  );
}
