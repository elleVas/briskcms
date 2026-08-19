import { randomUUID } from 'node:crypto';
import {
  SiteLayoutSection,
  SiteNotFoundError,
  type SiteLayoutSectionKind,
} from '@brisk/domain-core';
import type {
  SiteLayoutSectionRepositoryPort,
  SiteRepositoryPort,
} from '@brisk/ports';

export interface GetOrCreateSiteLayoutSectionDeps {
  siteRepository: SiteRepositoryPort;
  siteLayoutSectionRepository: SiteLayoutSectionRepositoryPort;
}

export interface GetOrCreateSiteLayoutSectionInput {
  tenantId: string;
  siteId: string;
  locale: string;
  kind: SiteLayoutSectionKind;
}

/**
 * Header/Footer non hanno nulla da chiedere all'utente prima di crearli
 * (niente slug/seoMeta, docs/adr/0018) — il primo accesso all'editor
 * "Aspetto" per una data (sito, locale, kind) crea implicitamente la riga,
 * così l'editor non deve mai gestire uno stato "non esiste ancora".
 *
 * Se il sito ha già un header/footer pubblicato nella sua locale di
 * default, il nuovo draft parte come copia di quel content invece che
 * vuoto — stessa filosofia "copy-on-translate" di createPageTranslation
 * (Fase 5b): abilitare una lingua non deve costringere a ricostruire
 * l'header da zero.
 *
 * Race TOCTOU tra due tab aperte in contemporanea non gestita apposta:
 * utenza realistica è un singolo admin non tecnico, non un SaaS ad alta
 * concorrenza. Il vincolo unique del DB resta il backstop.
 */
export async function getOrCreateSiteLayoutSection(
  deps: GetOrCreateSiteLayoutSectionDeps,
  input: GetOrCreateSiteLayoutSectionInput,
): Promise<SiteLayoutSection> {
  const site = await deps.siteRepository.findById(input.tenantId, input.siteId);
  if (!site) {
    throw new SiteNotFoundError(input.siteId);
  }

  const existing = await deps.siteLayoutSectionRepository.findBySiteLocaleKind(
    input.tenantId,
    input.siteId,
    input.locale,
    input.kind,
  );
  if (existing) {
    return existing;
  }

  let content;
  let sticky;
  if (input.locale !== site.defaultLocale) {
    const defaultSection =
      await deps.siteLayoutSectionRepository.findBySiteLocaleKind(
        input.tenantId,
        input.siteId,
        site.defaultLocale,
        input.kind,
      );
    content = defaultSection?.content;
    sticky = defaultSection?.sticky;
  }

  const section = SiteLayoutSection.create({
    id: randomUUID(),
    tenantId: input.tenantId,
    siteId: input.siteId,
    locale: input.locale,
    kind: input.kind,
    content,
    sticky,
  });
  await deps.siteLayoutSectionRepository.save(section);
  return section;
}
