import type { PageRepositoryPort, SiteRepositoryPort } from '@brisk/ports';
import { resolvePageByPath } from './resolve-page-by-path';

export interface ResolveUntranslatedPageFallbackDeps {
  siteRepository: SiteRepositoryPort;
  pageRepository: PageRepositoryPort;
}

export interface ResolveUntranslatedPageFallbackInput {
  tenantId: string;
  domain: string;
  locale: string;
  /** Full URL path, root to leaf — see resolvePageByPath. */
  segments: string[];
}

export interface UntranslatedPageFallbackTarget {
  locale: string;
  /** Same shape as the input's own `segments` — the path that resolved, under `locale`. */
  segments: string[];
}

/**
 * Chiamata SOLO quando `getPublishedPageBySlug` ha già restituito `null` per
 * (locale, segments) — navigazione diretta, link vecchio o crawler su una
 * pagina mai tradotta in quel locale, non passata dal language switcher
 * (che invece calcola il fallback da `translations`, note solo una volta
 * trovata una pagina). Senza `groupId` non c'è modo di risalire alle
 * traduzioni sorelle: l'unica euristica praticabile è "stesso percorso in un
 * altro locale abilitato" — copre il caso comune (URL identico tranne il
 * prefisso di locale), non quello di uno slug tradotto ad hoc, che resta
 * un 404 vero (non c'è comunque un modo di indovinarlo). Con slug scoped ai
 * fratelli (vedi resolvePageByPath), il percorso intero — non solo lo slug
 * finale — è ciò che deve corrispondere sotto l'altro locale: due pagine in
 * rami diversi possono avere lo stesso slug finale ma percorsi diversi, e
 * solo un match sull'intero percorso è univoco.
 *
 * Prova PRIMA il locale di default del sito (il comportamento previsto,
 * intenzionale nella maggioranza dei casi), poi — se quella pagina
 * specifica non esiste più — gli altri locale abilitati nell'ordine in cui
 * sono elencati. Necessario perché la pagina in locale di default di un
 * gruppo può essere cancellata mentre le sue sorelle in altri locale
 * restano pubblicate: ancorare il fallback a un solo locale fisso
 * romperebbe il redirect per l'intero gruppo in quel caso, anche se una
 * sorella con lo stesso percorso è ancora viva altrove.
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
    const resolved = await resolvePageByPath(
      deps.pageRepository,
      input.tenantId,
      site.id,
      candidateLocale,
      input.segments,
    );
    if (
      resolved &&
      resolved.page.status === 'published' &&
      resolved.page.publishedContent
    ) {
      return { locale: resolved.page.locale, segments: input.segments };
    }
  }

  return null;
}
