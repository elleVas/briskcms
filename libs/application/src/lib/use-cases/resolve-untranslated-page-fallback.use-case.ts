import type { PageRepositoryPort, SiteRepositoryPort } from '@brisk/ports';

export interface ResolveUntranslatedPageFallbackDeps {
  siteRepository: SiteRepositoryPort;
  pageRepository: PageRepositoryPort;
}

export interface ResolveUntranslatedPageFallbackInput {
  tenantId: string;
  domain: string;
  locale: string;
  slug: string;
}

export interface UntranslatedPageFallbackTarget {
  locale: string;
  slug: string;
}

/**
 * Chiamata SOLO quando `getPublishedPageBySlug` ha già restituito `null` per
 * (locale, slug) — navigazione diretta, link vecchio o crawler su una
 * pagina mai tradotta in quel locale, non passata dal language switcher
 * (che invece calcola il fallback da `translations`, note solo una volta
 * trovata una pagina). Senza `groupId` non c'è modo di risalire alle
 * traduzioni sorelle: l'unica euristica praticabile è "stesso slug, locale
 * di default del sito" — copre il caso comune (URL identico tranne il
 * prefisso di locale), non quello di uno slug tradotto ad hoc, che resta
 * un 404 vero (non c'è comunque un modo di indovinarlo).
 */
export async function resolveUntranslatedPageFallback(
  deps: ResolveUntranslatedPageFallbackDeps,
  input: ResolveUntranslatedPageFallbackInput,
): Promise<UntranslatedPageFallbackTarget | null> {
  const site = await deps.siteRepository.findByDomain(
    input.tenantId,
    input.domain,
  );
  if (!site) {
    return null;
  }
  if (site.untranslatedPageFallback !== 'redirect-to-default') {
    return null;
  }
  if (input.locale === site.defaultLocale) {
    // Già nel locale di default: non c'è un locale "più di default" a cui
    // ripiegare, il 404 è reale.
    return null;
  }

  const fallbackPage = await deps.pageRepository.findBySlug(
    input.tenantId,
    site.id,
    site.defaultLocale,
    input.slug,
  );
  if (
    !fallbackPage ||
    fallbackPage.status !== 'published' ||
    !fallbackPage.publishedContent
  ) {
    return null;
  }

  return { locale: fallbackPage.locale, slug: fallbackPage.slug };
}
