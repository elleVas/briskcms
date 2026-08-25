import type {
  PageRepositoryPort,
  PreviewTokenPort,
  SiteLayoutSectionRepositoryPort,
  SiteRepositoryPort,
  SiteThemeBlockStylesPort,
} from '@brisk/ports';
import { resolveSiteChrome } from './resolve-site-chrome.js';
import { resolvePageAncestors } from './resolve-page-ancestors.js';
import type { PublishedPage } from './get-published-page-by-slug.use-case.js';

export interface GetPreviewPageByIdDeps {
  pageRepository: PageRepositoryPort;
  siteRepository: SiteRepositoryPort;
  siteLayoutSectionRepository: SiteLayoutSectionRepositoryPort;
  siteThemeBlockStylesRepository: SiteThemeBlockStylesPort;
  previewTokenPort: PreviewTokenPort;
}

export interface GetPreviewPageByIdInput {
  tenantId: string;
  pageId: string;
  token: string;
}

/**
 * L'editing draft, unauthenticated read path (vedi il piano dell'editor
 * visuale, Giorno 1) — a differenza di getPublishedPageBySlug, mostra
 * sempre `content` (la bozza), a prescindere da `status`, e non gate su
 * `published_content` esistente. Valida il token per primo: `null` per
 * token mancante/scaduto/mismatch è indistinguibile da "pagina non
 * esiste", stessa postura di getPublishedPageBySlug (nessun oracolo per
 * indovinare id di pagina validi).
 *
 * Un token di preview valido per QUESTA pagina abilita anche a vedere la
 * bozza vera di header/footer (resolveSiteChrome in modalità preview) — non
 * serve un token separato per la sezione: chi ha un token pagina valido è
 * già un editor autenticato che sta previewando questo sito.
 */
export async function getPreviewPageById(
  deps: GetPreviewPageByIdDeps,
  input: GetPreviewPageByIdInput,
): Promise<PublishedPage | null> {
  const validToken = await deps.previewTokenPort.validateToken(
    input.token,
    'page',
    input.pageId,
  );
  if (!validToken || validToken.tenantId !== input.tenantId) {
    return null;
  }

  const page = await deps.pageRepository.findById(input.tenantId, input.pageId);
  if (!page) {
    return null;
  }

  const site = await deps.siteRepository.findById(input.tenantId, page.siteId);
  if (!site) {
    return null;
  }

  const [siblings, chrome, ancestors] = await Promise.all([
    deps.pageRepository.listByGroup(input.tenantId, site.id, page.groupId),
    resolveSiteChrome(deps, input.tenantId, site, page.locale, {
      preview: true,
    }),
    resolvePageAncestors(deps.pageRepository, input.tenantId, page.parentId),
  ]);
  const translations = siblings
    .filter((sibling) => sibling.status === 'published')
    .map((sibling) => ({ locale: sibling.locale, slug: sibling.slug }));

  return {
    content: page.content,
    seoMeta: page.seoMeta,
    locale: page.locale,
    translations,
    ancestors,
    header: chrome.header,
    footer: chrome.footer,
    headerSticky: chrome.headerSticky,
    site: chrome.site,
  };
}
