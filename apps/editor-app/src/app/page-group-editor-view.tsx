import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from '@tanstack/react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ExternalLink,
  GitFork,
  History,
  Languages,
  LayoutTemplate,
  Link2,
  Search,
  Tags,
} from 'lucide-react';
import { relinkedOverlay } from '@brisk/shared-types';
import { ApiError, actionErrorMessage } from '../lib/http-client';
import {
  savePageGroupAsTemplate,
  type PageGroupRecord,
} from '../lib/page-groups-api-client';
import { CanvasEditorShell } from './canvas/canvas-editor-shell';
import { collectionsQueryOptions } from './collections-queries';
import { LanguageSwitcher } from './canvas/language-switcher';
import { ConfirmActionDialog } from './confirm-action-dialog';
import { FormListProvider } from './form-list-provider';
import { IconListProvider } from './icon-list-provider';
import { MediaPickerProvider } from './media-picker-provider';
import { PageGroupSeoPanelDialog } from './page-group-seo-panel-dialog';
import { PageGroupTermsDialog } from './page-group-terms-dialog';
import { PageGroupTranslationsDialog } from './page-group-translations-dialog';
import { PageListProvider } from './page-list-provider';
import { reusableSectionsQueryKey } from './reusable-sections-queries';
import { useToast } from './toast-provider';
import { publicPagePath } from '../lib/public-page-path';
import { PUBLIC_SITE_URL } from '../lib/public-site-url';
import { usePageBlockRegistry } from './use-page-block-registry';
import { useSaveStatusText } from './save-status-text';
import { usePageGroupEditor } from './use-page-group-editor';
import { usePageGroupVersions } from './use-page-group-versions';
import { usePageTranslationVersions } from './use-page-translation-versions';
import { translatableFieldsOf } from './translatable-fields';
import {
  VersionHistoryDialog,
  type VersionSource,
} from './version-history-dialog';

/**
 * Back to where this page is listed, which is not always Pages.
 *
 * A page filed in a collection belongs to that collection's screen: sending
 * somebody who opened an article from News back to Pages drops them
 * somewhere they were not, with their article nowhere in the list. It
 * reads the page's own collection rather than the history, so it is still
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
 * history has two sources: the shared structure and the active language's
 * own content, which is where an unlinked language keeps its tree
 * (docs/adr/0075). Page-picking (Link/NavLink/
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
    isSaving,
    onChange,
    whenSaved,
    hasFailedSave,
    onSaveFieldValue,
    handlePublish,
    handleDiverge,
    handleRelink,
  } = usePageGroupEditor(groupId, initialLocale);
  const statusText = useSaveStatusText(status, {
    publishedKey: 'pages.editor.published',
    // Once the page IS published, a landed save has moved the draft past
    // what a visitor sees. "Draft saved" would be true and beside the
    // point; the fact worth a line in the bar is that the two no longer
    // match. Until the first publish there is nothing online to be behind.
    savedKey:
      activeTranslation.status === 'published'
        ? 'pages.editor.unpublishedChangesAt'
        : undefined,
  });
  const [isDivergeConfirmOpen, setIsDivergeConfirmOpen] = useState(false);
  const [isRelinkConfirmOpen, setIsRelinkConfirmOpen] = useState(false);
  const [isSeoOpen, setIsSeoOpen] = useState(false);
  const [isTermsOpen, setIsTermsOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isTranslationsOpen, setIsTranslationsOpen] = useState(false);
  const [restoredAt, setRestoredAt] = useState(0);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  // An unlinked language no longer follows the shared structure, so that
  // history is not offered there: restoring it would change every other
  // language and leave the one on screen as it was.
  const structureHistory = usePageGroupVersions(
    groupId,
    isHistoryOpen && !activeTranslation.isDiverged,
  );
  const languageHistory = usePageTranslationVersions(
    groupId,
    activeTranslation.id,
    isHistoryOpen,
  );
  const translatableFields = useMemo(
    () => translatableFieldsOf(registry),
    [registry],
  );

  // What relinking would drop, for the dialog to say before it happens.
  // Computed from what is on screen; the relink itself recomputes it from
  // what the server holds once every pending save has landed.
  const blocksLostOnRelink = useMemo(
    () =>
      activeTranslation.divergedContent
        ? relinkedOverlay(
            group.content,
            activeTranslation.divergedContent,
            translatableFields,
          ).lostBlockCount
        : 0,
    [group.content, activeTranslation.divergedContent, translatableFields],
  );

  async function confirmDiverge() {
    setIsDivergeConfirmOpen(false);
    await handleDiverge();
  }

  async function confirmRelink() {
    setIsRelinkConfirmOpen(false);
    try {
      // The same wait as "save as template": relinking from a fork the
      // server never received would carry over text that is not there.
      await whenSaved();
      if (hasFailedSave()) {
        toast(t('canvas.language.relinkUnsaved'), 'destructive');
        return;
      }
      await handleRelink(translatableFields);
      setRestoredAt((n) => n + 1);
      toast(
        t('canvas.language.relinked', {
          locale: activeLocale.toUpperCase(),
        }),
        'success',
      );
    } catch (caught) {
      toast(
        actionErrorMessage(caught, t('canvas.language.relinkFailed')),
        'destructive',
      );
    }
  }

  /**
   * "Save as template" (docs/adr/0072). The name is asked with a prompt,
   * as "turn into a reusable section" asks it: a name is the only thing
   * this needs. It starts from the page's title in the site's default
   * language, which is the language the template will hold.
   *
   * The canvas has already sent any change still in its debounce by the
   * time this runs (see CanvasEditorShell's page menu); waiting for that
   * save to land, and refusing when it did not, is what makes the template
   * the page as it is on screen.
   */
  async function handleSaveAsTemplate() {
    const inDefaultLanguage = translations.find(
      (translation) => translation.locale === defaultLocale,
    );
    const name = window
      .prompt(
        t('pages.saveAsTemplate.prompt'),
        (inDefaultLanguage ?? activeTranslation).seoMeta.title,
      )
      ?.trim();
    if (!name) {
      return;
    }
    try {
      await whenSaved();
      // A save that failed has settled too, and the server would copy the
      // page as it was before that edit while the toast said "saved".
      if (hasFailedSave()) {
        toast(t('pages.saveAsTemplate.unsaved'), 'destructive');
        return;
      }
      const template = await savePageGroupAsTemplate(groupId, name);
      await queryClient.invalidateQueries({
        queryKey: reusableSectionsQueryKey(group.siteId),
      });
      toast(
        t('pages.saveAsTemplate.saved', { name: template.name }),
        'success',
      );
    } catch (caught) {
      toast(
        caught instanceof ApiError && caught.status === 409
          ? t('sections.nameTaken')
          : actionErrorMessage(caught, t('pages.saveAsTemplate.failed')),
        'destructive',
      );
    }
  }

  function restoringWith(rollback: (versionId: string) => Promise<unknown>) {
    return async (versionId: string) => {
      // A save still on its way would land after the restore and
      // overwrite it with the page as it was before.
      await whenSaved();
      await rollback(versionId);
      setRestoredAt((n) => n + 1);
    };
  }

  const languageLabel = activeLocale.toUpperCase();
  const languageSource: VersionSource = {
    key: 'language',
    label: t('pages.versionHistory.sources.language', {
      locale: languageLabel,
    }),
    versions: languageHistory.versions.map((version) => ({
      id: version.id,
      createdAt: version.createdAt,
      // Restoring one of these unlinks the language again — the one thing
      // a restore does here that it never did before.
      note: version.divergedContent
        ? t('pages.versionHistory.unlinkedNote')
        : undefined,
    })),
    isLoading: languageHistory.isLoading,
    onRollback: restoringWith(languageHistory.rollback),
  };
  const historySources: VersionSource[] = activeTranslation.isDiverged
    ? [languageSource]
    : [
        {
          key: 'structure',
          label: t('pages.versionHistory.sources.structure'),
          versions: structureHistory.versions,
          isLoading: structureHistory.isLoading,
          onRollback: restoringWith(structureHistory.rollback),
        },
        // The site's own language has its text IN the structure, so its
        // own history is only ever the forks it had — offered once there
        // is one, rather than as an empty tab next to every page.
        ...(activeLocale !== defaultLocale ||
        languageHistory.versions.length > 0
          ? [languageSource]
          : []),
      ];

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
              // The middle of the bar was empty — the page being edited was
              // named nowhere in the editor at all.
              title={
                activeTranslation.seoMeta.title || `/${activeTranslation.slug}`
              }
              statusText={statusText}
              isSaving={isSaving}
              /*
               * Six unlabelled icons became a menu that says what each of
               * them does. They are the actions on the PAGE — its SEO, its
               * classification, its languages, its history — and sitting
               * next to undo and redo as icons there was nothing to
               * distinguish them from the actions on the CANVAS.
               */
              pageMenu={[
                {
                  label: t('pages.seo.open'),
                  icon: Search,
                  onSelect: () => setIsSeoOpen(true),
                },
                {
                  label: t('taxonomies.pageTitle'),
                  icon: Tags,
                  onSelect: () => setIsTermsOpen(true),
                },
                {
                  label: t('pages.translations.open'),
                  icon: Languages,
                  onSelect: () => setIsTranslationsOpen(true),
                },
                {
                  label: t('pages.versionHistory.open'),
                  icon: History,
                  onSelect: () => setIsHistoryOpen(true),
                },
                {
                  label: t('pages.saveAsTemplate.open'),
                  icon: LayoutTemplate,
                  onSelect: () => void handleSaveAsTemplate(),
                },
                activeTranslation.isDiverged
                  ? {
                      label: t('canvas.language.relinkAction'),
                      icon: Link2,
                      onSelect: () => setIsRelinkConfirmOpen(true),
                    }
                  : {
                      label: t('canvas.language.divergeAction'),
                      icon: GitFork,
                      onSelect: () => setIsDivergeConfirmOpen(true),
                    },
                // Same "only once there's something live to see" gate as
                // before, and still a real link so it can be middle-clicked
                // or copied.
                ...(activeTranslation.status === 'published'
                  ? [
                      {
                        label: t('pages.editor.viewPage'),
                        icon: ExternalLink,
                        href: `${PUBLIC_SITE_URL}${publicPagePath(activeTranslation.locale, activeTranslation.slug)}`,
                      },
                    ]
                  : []),
              ]}
              registry={registry}
              categories={categories}
              blocks={displayedBlocks}
              onChange={onChange}
              whenSaved={whenSaved}
              onPublish={handlePublish}
              pageId={activeTranslation.id}
              restoredAt={restoredAt}
            >
              <VersionHistoryDialog
                // Remounted per language, so a tab chosen on one does not
                // carry over to another where it means something else.
                key={activeTranslation.id}
                sources={historySources}
                open={isHistoryOpen}
                onOpenChange={setIsHistoryOpen}
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
              <ConfirmActionDialog
                open={isRelinkConfirmOpen}
                onOpenChange={setIsRelinkConfirmOpen}
                title={t('canvas.language.relinkConfirmTitle', {
                  locale: languageLabel,
                })}
                description={[
                  t('canvas.language.relinkConfirmBody'),
                  blocksLostOnRelink > 0
                    ? t('canvas.language.relinkConfirmLost', {
                        count: blocksLostOnRelink,
                      })
                    : null,
                  t('canvas.language.relinkConfirmHistory'),
                ]
                  .filter(Boolean)
                  .join(' ')}
                onConfirm={() => void confirmRelink()}
                actionLabel={t('canvas.language.relinkConfirmAction')}
                actionVariant={
                  blocksLostOnRelink > 0 ? 'destructive' : 'default'
                }
              />
            </CanvasEditorShell>
          </PageListProvider>
        </IconListProvider>
      </FormListProvider>
    </MediaPickerProvider>
  );
}
