import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import {
  ExternalLink,
  GitFork,
  History,
  Languages,
  Search,
  Tags,
} from 'lucide-react';
import type { PageGroupRecord } from '../lib/page-groups-api-client';
import { CanvasEditorShell } from './canvas/canvas-editor-shell';
import { collectionsQueryOptions } from './collections-queries';
import { LanguageSwitcher } from './canvas/language-switcher';
import { ConfirmActionDialog } from './confirm-action-dialog';
import { FormListProvider } from './form-list-provider';
import { IconButton } from './icon-button';
import { IconListProvider } from './icon-list-provider';
import { MediaPickerProvider } from './media-picker-provider';
import { PageGroupSeoPanelDialog } from './page-group-seo-panel-dialog';
import { PageGroupTermsDialog } from './page-group-terms-dialog';
import { PageGroupTranslationsDialog } from './page-group-translations-dialog';
import { PageListProvider } from './page-list-provider';
import { publicPagePath } from '../lib/public-page-path';
import { PUBLIC_SITE_URL } from '../lib/public-site-url';
import { usePageBlockRegistry } from './use-page-block-registry';
import { usePageGroupEditor, type SaveStatus } from './use-page-group-editor';
import { usePageGroupVersions } from './use-page-group-versions';
import { VersionHistoryDialog } from './version-history-dialog';

/**
 * Back to where this page is listed, which is not always Pages.
 *
 * A page filed in a section belongs to that section's screen: sending
 * somebody who opened an article from News back to Pages drops them
 * somewhere they were not, with their article nowhere in the list. It
 * reads the page's own section rather than the history, so it is still
 * right on a reloaded tab or a shared link.
 */
function BackToList({ group }: { group: PageGroupRecord }) {
  const { t } = useTranslation();
  const { data: collections } = useQuery({
    ...collectionsQueryOptions(group.siteId),
    enabled: group.collectionId !== null,
  });
  const collection = (collections ?? []).find(
    (one) => one.id === group.collectionId,
  );

  if (!collection) {
    return (
      <Link to="/pages" className="hover:underline">
        ← {t('pages.editor.backToList')}
      </Link>
    );
  }
  return (
    <Link
      to="/collections/$collectionId"
      params={{ collectionId: collection.id }}
      className="hover:underline"
    >
      ← {collection.name}
    </Link>
  );
}

export interface PageGroupEditorViewProps {
  groupId: string;
  initialLocale: string;
  /**
   * The SITE's default locale — distinct from `initialLocale` (which
   * locale this view starts on): a group with no translation in the
   * site's default locale starts on whatever locale IS there instead (see
   * the route), but `translationRouting` below still needs the real site
   * default to decide when a translatable field writes to the shared
   * structure vs. this translation's own overlay.
   */
  defaultLocale: string;
  /** Every locale the site offers — the translations dialog needs this to know which ones are still missing from this group. */
  enabledLocales: string[];
}

function useStatusText(status: SaveStatus): string {
  const { t } = useTranslation();
  switch (status.kind) {
    case 'idle':
      return '';
    case 'saved':
      return t('pages.editor.draftSaved');
    case 'published':
      return t('pages.editor.published');
    case 'error':
      return status.message;
  }
}

/**
 * i18n a livello di campo (see the plan) — PageGroupEditorView is
 * page-editor-view.tsx's counterpart for the new PageGroup/PageTranslation
 * model: one PageGroup, a LanguageSwitcher to move between its
 * translations in place (no route change, see canvas-editor-shell.tsx's
 * own `languageSwitcher`/`translationRouting` props), plus SEO panel,
 * version history, and a translations-management dialog — same three
 * capabilities as the old PageEditorView, each rebuilt against the new
 * model instead of reused wholesale (see page-group-seo-panel-dialog.tsx/
 * use-page-group-versions.ts/page-group-translations-dialog.tsx's own
 * doc comments for what changed and what didn't carry over). Version
 * history only tracks the shared PageGroup structure, not a diverged
 * translation's own divergedContent — a real, accepted gap, see
 * use-page-group-versions.ts's own comment. Page-picking (Link/NavLink/
 * Button/Banner/PromoBar/PricingPlan's `page` field) IS wired up, via
 * PageListProvider below.
 */
export function PageGroupEditorView({
  groupId,
  initialLocale,
  defaultLocale,
  enabledLocales,
}: PageGroupEditorViewProps) {
  const { t } = useTranslation();
  const { registry, categories } = usePageBlockRegistry();
  const {
    group,
    translations,
    activeLocale,
    setActiveLocale,
    activeTranslation,
    displayedBlocks,
    status,
    onChange,
    onSaveFieldValue,
    handlePublish,
    handleDiverge,
  } = usePageGroupEditor(groupId, initialLocale);
  const statusText = useStatusText(status);
  const [isDivergeConfirmOpen, setIsDivergeConfirmOpen] = useState(false);
  const [isSeoOpen, setIsSeoOpen] = useState(false);
  const [isTermsOpen, setIsTermsOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isTranslationsOpen, setIsTranslationsOpen] = useState(false);
  const [restoredAt, setRestoredAt] = useState(0);
  const {
    versions,
    isLoading: isLoadingVersions,
    rollback,
  } = usePageGroupVersions(groupId, isHistoryOpen);

  async function confirmDiverge() {
    setIsDivergeConfirmOpen(false);
    await handleDiverge();
  }

  async function handleRollback(versionId: string) {
    await rollback(versionId);
    setRestoredAt((n) => n + 1);
  }

  return (
    // Same provider-nesting reasoning as page-editor-view.tsx, plus
    // PageListProvider (missing here until now — a real pre-existing gap:
    // picking a page for a Link/Button/Banner/PromoBar/PricingPlan/NavLink
    // block threw outside a PageListContext.Provider). Scoped to
    // `activeLocale`: the picker's own LISTING still filters by locale for
    // a sensible UX (docs/adr/0018), even though what gets stored is now
    // locale-independent (see page-list-provider.tsx's own comment).
    <MediaPickerProvider siteId={group.siteId}>
      <FormListProvider siteId={group.siteId}>
        <IconListProvider>
          <PageListProvider siteId={group.siteId} locale={activeLocale}>
            <CanvasEditorShell
              backLink={<BackToList group={group} />}
              languageSwitcher={
                <LanguageSwitcher
                  translations={translations}
                  value={activeLocale}
                  onChange={setActiveLocale}
                />
              }
              translationRouting={
                activeTranslation.isDiverged
                  ? undefined
                  : {
                      activeLocale,
                      defaultLocale,
                      onSaveFieldValue,
                    }
              }
              siteId={group.siteId}
              statusText={statusText}
              actions={
                <>
                  <IconButton
                    label={t('pages.seo.open')}
                    onClick={() => setIsSeoOpen(true)}
                  >
                    <Search />
                  </IconButton>
                  <IconButton
                    label={t('taxonomies.pageTitle')}
                    onClick={() => setIsTermsOpen(true)}
                  >
                    <Tags />
                  </IconButton>
                  <IconButton
                    label={t('pages.versionHistory.open')}
                    onClick={() => setIsHistoryOpen(true)}
                  >
                    <History />
                  </IconButton>
                  <IconButton
                    label={t('pages.translations.open')}
                    onClick={() => setIsTranslationsOpen(true)}
                  >
                    <Languages />
                  </IconButton>
                  {!activeTranslation.isDiverged && (
                    <IconButton
                      label={t('canvas.language.divergeAction')}
                      onClick={() => setIsDivergeConfirmOpen(true)}
                    >
                      <GitFork />
                    </IconButton>
                  )}
                  {/* Same "only once there's something live to see" gate as
                    page-editor-view.tsx. */}
                  {activeTranslation.status === 'published' && (
                    <IconButton label={t('pages.editor.viewPage')} asChild>
                      <a
                        href={`${PUBLIC_SITE_URL}${publicPagePath(activeTranslation.locale, activeTranslation.slug)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <ExternalLink />
                      </a>
                    </IconButton>
                  )}
                </>
              }
              registry={registry}
              categories={categories}
              blocks={displayedBlocks}
              onChange={onChange}
              onPublish={handlePublish}
              pageId={activeTranslation.id}
              restoredAt={restoredAt}
            >
              <VersionHistoryDialog
                versions={versions}
                isLoading={isLoadingVersions}
                open={isHistoryOpen}
                onOpenChange={setIsHistoryOpen}
                onRollback={handleRollback}
              />
              <PageGroupSeoPanelDialog
                groupId={groupId}
                translationId={activeTranslation.id}
                parentGroupId={group.parentId}
                seoMeta={activeTranslation.seoMeta}
                open={isSeoOpen}
                onOpenChange={setIsSeoOpen}
              />
              <PageGroupTermsDialog
                groupId={groupId}
                siteId={group.siteId}
                open={isTermsOpen}
                onOpenChange={setIsTermsOpen}
              />
              <PageGroupTranslationsDialog
                groupId={groupId}
                parentGroupId={group.parentId}
                translations={translations}
                enabledLocales={enabledLocales}
                activeLocale={activeLocale}
                onSelectLocale={setActiveLocale}
                open={isTranslationsOpen}
                onOpenChange={setIsTranslationsOpen}
              />
              <ConfirmActionDialog
                open={isDivergeConfirmOpen}
                onOpenChange={setIsDivergeConfirmOpen}
                title={t('canvas.language.divergeConfirmTitle', {
                  locale: activeLocale.toUpperCase(),
                })}
                description={t('canvas.language.divergeConfirmBody')}
                onConfirm={() => void confirmDiverge()}
                actionLabel={t('canvas.language.divergeConfirmAction')}
                actionVariant="default"
              />
            </CanvasEditorShell>
          </PageListProvider>
        </IconListProvider>
      </FormListProvider>
    </MediaPickerProvider>
  );
}
