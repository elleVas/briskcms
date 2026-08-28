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
 * traduzioni sorelle: l'unica euristica praticabile è "stesso slug in un
 * altro locale abilitato" — copre il caso comune (URL identico tranne il
 * prefisso di locale), non quello di uno slug tradotto ad hoc, che resta
 * un 404 vero (non c'è comunque un modo di indovinarlo).
 *
 * Prova PRIMA il locale di default del sito (il comportamento previsto,
 * intenzionale nella maggioranza dei casi), poi — se quella pagina
 * specifica non esiste più — gli altri locale abilitati nell'ordine in cui
 * sono elencati. Necessario perché la pagina in locale di default di un
 * gruppo può essere cancellata mentre le sue sorelle in altri locale
 * restano pubblicate: ancorare il fallback a un solo locale fisso
 * romperebbe il redirect per l'intero gruppo in quel caso, anche se una
 * sorella con lo stesso slug è ancora viva altrove.
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

  const candidateLocales = [
    site.defaultLocale,
    ...site.enabledLocales.filter(
      (locale) => locale !== site.defaultLocale && locale !== input.locale,
    ),
  ];

  for (const candidateLocale of candidateLocales) {
    const fallbackPage = await deps.pageRepository.findBySlug(
      input.tenantId,
      site.id,
      candidateLocale,
      input.slug,
    );
    if (
      fallbackPage &&
      fallbackPage.status === 'published' &&
      fallbackPage.publishedContent
    ) {
      return { locale: fallbackPage.locale, slug: fallbackPage.slug };
    }
  }

  return null;
}
