/**
 * Backfill una tantum: converte il vecchio modello "una Page per locale,
 * collegata da groupId" (ADR-0017) nel nuovo modello i18n a livello di
 * campo (struttura condivisa in PageGroup + overlay di testo per-locale in
 * PageTranslation) — vedi il piano `majestic-petting-lampson.md`.
 *
 * Per ogni `groupId` esistente:
 * 1. La pagina nella locale di DEFAULT del sito diventa la PageGroup
 *    canonica (struttura + valori di default dei campi traducibili).
 *    Riusa lo stesso `groupId` come id del nuovo PageGroup — nessuna
 *    tabella di remapping serve altrove.
 * 2. Ogni pagina del gruppo (inclusa quella canonica) diventa una
 *    PageTranslation. Se la sua struttura combacia esattamente con quella
 *    canonica (stesso `computeContentStructureSignature`), i valori dei
 *    campi `translatable` che differiscono da quelli canonici finiscono
 *    in `fieldValues` (overlay leggero) — altrimenti la traduzione parte
 *    già `isDiverged: true` con `divergedContent` = il suo contenuto
 *    attuale intatto (zero perdita per una traduzione già indipendente
 *    nei fatti, il vecchio drift-detector la segnalava già come tale).
 * 3. La gerarchia (parentId) diventa condivisa: il parentId della pagina
 *    canonica, mappato al GROUPID del suo genitore (non il suo pageId).
 *
 * Deliberatamente NON migra lo storico di `page_versions` — retro-
 * costruire quale fosse la struttura "canonica" ad ogni versione passata
 * è ambiguo (la locale di default può essere cambiata nel frattempo, o
 * una versione può risalire a prima che questo stesso concetto esistesse)
 * e non è mai stato promesso dal piano. Ogni nuovo PageGroup/
 * PageTranslation riparte con UNA versione iniziale (lo stato al momento
 * del backfill), non l'intera cronologia — accettabile: questo progetto
 * non ha ancora un DB di produzione, solo dati di sviluppo (docs-showcase).
 *
 * Idempotente SOLO se rieseguito su un DB che non ha ancora popolato
 * page_groups/page_translations — NON pensato per essere rieseguito dopo
 * un primo giro riuscito (troverebbe di nuovo le vecchie `pages`, invariate,
 * e ricreerebbe righe duplicate). Da girare una volta, in un momento di
 * manutenzione, con le vecchie tabelle `pages`/`page_versions` lasciate
 * intatte (rimosse solo alla fine del piano, dopo verifica completa).
 */
import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import {
  computeContentStructureSignature,
  type Block,
  type FieldValueOverlay,
  type PageContent,
} from '@brisk/shared-types';
import {
  createAppDb,
  withTenant,
  type BriskDb,
  type BriskTx,
} from '../src/lib/client';
import {
  pageGroupVersions,
  pageGroups,
  pageTranslationVersions,
  pageTranslations,
  pages,
  sites,
  tenants,
} from '../src/lib/schema';

// Fonte di verità duplicata DELIBERATAMENTE da
// libs/block-registry/src/lib/blocks/*.block.ts's `translatable: true`
// (vedi l'audit) — non importata da @brisk/block-registry qui: questo è
// uno script Node una tantum, non vale la pena legare `@brisk/postgres-db`
// (uno strato adapter) a un pacchetto React/editor solo per una lettura di
// metadati che non cambierà più una volta finito questo backfill. Se un
// nuovo campo `translatable` viene aggiunto DOPO che questo script è già
// stato eseguito con successo, non serve più aggiornare questa mappa.
// I 6 tipi che riusano ctaLinkFields() (libs/block-registry/src/lib/fields/
// link-type-field.ts) portano anche `url` — trovato dal vivo che un sito
// reale lo usa spesso per un percorso interno relativo ("/it/docs") invece
// del PagePickerField vero, quindi deve variare per lingua come qualunque
// altro campo di testo (vedi il commento su quel campo).
const CTA_LINK_FIELDS = ['url'];

const TRANSLATABLE_FIELDS: Record<string, string[]> = {
  Banner: ['title', 'text', 'buttonLabel', ...CTA_LINK_FIELDS],
  AccordionItem: ['question', 'answer'],
  Button: ['label', ...CTA_LINK_FIELDS],
  BeforeAfter: ['beforeLabel', 'afterLabel'],
  Breadcrumb: ['homeLabel'],
  Code: ['code'],
  Feature: ['title', 'text'],
  Countdown: ['label'],
  Hero: ['title', 'subtitle'],
  Link: ['label', ...CTA_LINK_FIELDS],
  Image: ['alt', 'caption'],
  NavDropdown: ['label'],
  NavLink: ['label', ...CTA_LINK_FIELDS],
  PromoBar: ['message', ...CTA_LINK_FIELDS],
  PricingPlan: ['name', 'price', 'period', 'buttonLabel', ...CTA_LINK_FIELDS],
  NewsletterSignup: ['title', 'buttonLabel'],
  SearchBox: ['placeholder'],
  Stat: ['prefix', 'suffix', 'label'],
  Quote: ['quote', 'role'],
  Rating: ['label'],
  Tab: ['label'],
  Testimonial: ['quote', 'role'],
  TeamMember: ['role', 'bio'],
  TimelineStep: ['label', 'title', 'description'],
  Text: ['body'],
  WhatsAppButton: ['message'],
};

/**
 * Estrae in `fieldValues` solo i valori che DIFFERISCONO dalla struttura
 * canonica — cammina per INDICE, valido solo perché il chiamante ha già
 * verificato che le due strutture combaciano esattamente
 * (computeContentStructureSignature identica). Direzione inversa di
 * mergeTranslatedContent (@brisk/shared-types), deliberatamente non lì:
 * quella resta a senso unico, questa è logica di migrazione una tantum.
 */
function extractFieldValues(
  translationContent: PageContent,
  canonicalContent: PageContent,
): FieldValueOverlay {
  const overlay: FieldValueOverlay = {};

  function walk(translationBlocks: Block[], canonicalBlocks: Block[]): void {
    translationBlocks.forEach((tBlock, index) => {
      const cBlock = canonicalBlocks[index];
      // Chiavato sull'id del blocco CANONICO (quello che sopravvive su
      // PageGroup.content), non su quello della traduzione — ogni locale
      // aveva i propri id indipendenti sotto il vecchio modello
      // (createPageTranslation copiava solo la FORMA dell'albero, non gli
      // id reali). mergeTranslatedContent cerca `fieldValues[block.id]`
      // camminando `groupContent` (canonico): un overlay chiavato
      // sull'id sbagliato non verrebbe MAI trovato — bug reale, trovato
      // dal vivo con la verifica di round-trip, non solo teorizzato.
      if (!cBlock?.id) return;

      const keys = TRANSLATABLE_FIELDS[tBlock.type] ?? [];
      for (const key of keys) {
        const tValue = tBlock.props[key];
        const cValue = cBlock.props[key];
        if (typeof tValue === 'string' && tValue !== cValue) {
          overlay[cBlock.id] = { ...overlay[cBlock.id], [key]: tValue };
        }
      }

      if (tBlock.children && cBlock.children) {
        walk(tBlock.children, cBlock.children);
      }
    });
  }

  walk(translationContent, canonicalContent);
  return overlay;
}

interface OldPageRow {
  id: string;
  siteId: string;
  groupId: string;
  locale: string;
  slug: string;
  parentId: string | null;
  status: 'draft' | 'published';
  content: PageContent;
  publishedContent: PageContent | null;
  seoMeta: {
    title: string;
    description: string;
    ogTags?: Record<string, string>;
    canonical?: string;
  };
  order: number;
  createdBy: string | null;
  createdAt: Date;
  updatedAt: Date;
}

let groupsCreated = 0;
let translationsCreated = 0;
let divergedCount = 0;

async function backfillTenant(tx: BriskTx, tenantId: string): Promise<void> {
  const siteRows = await tx
    .select({ id: sites.id, defaultLocale: sites.defaultLocale })
    .from(sites)
    .where(eq(sites.tenantId, tenantId));
  const defaultLocaleBySite = new Map(
    siteRows.map((s) => [s.id, s.defaultLocale]),
  );

  const allPages = (await tx
    .select()
    .from(pages)
    .where(eq(pages.tenantId, tenantId))) as unknown as OldPageRow[];
  if (allPages.length === 0) return;

  // pageId -> groupId, per rimappare parentId (un id di pagina) nel
  // parentId condiviso del nuovo modello (un id di GRUPPO).
  const groupIdByPageId = new Map(allPages.map((p) => [p.id, p.groupId]));

  const pagesByGroup = new Map<string, OldPageRow[]>();
  for (const page of allPages) {
    const group = pagesByGroup.get(page.groupId) ?? [];
    group.push(page);
    pagesByGroup.set(page.groupId, group);
  }

  // Prima passata: risolve canonica + parentGroupId per OGNI gruppo prima
  // di inserire qualunque riga — l'ordine di iterazione della Map non
  // garantisce che un genitore venga prima dei suoi figli, e page_groups
  // ha un vincolo FK self-referenziale su parentId (vedi schema.ts). Ogni
  // riga viene quindi inserita con `parentId: null`, poi una seconda
  // passata la aggiorna al valore reale — evita del tutto il problema
  // dell'ordine invece di provare a topologicamente ordinare i gruppi.
  interface ResolvedGroup {
    groupId: string;
    siteId: string;
    canonical: OldPageRow;
    canonicalSignature: string;
    newParentGroupId: string | null;
  }
  const resolvedGroups: ResolvedGroup[] = [];
  for (const [groupId, groupPages] of pagesByGroup) {
    const siteId = groupPages[0].siteId;
    const defaultLocale = defaultLocaleBySite.get(siteId);
    const canonical =
      groupPages.find((p) => p.locale === defaultLocale) ??
      [...groupPages].sort(
        (a, b) => a.createdAt.getTime() - b.createdAt.getTime(),
      )[0];
    resolvedGroups.push({
      groupId,
      siteId,
      canonical,
      canonicalSignature: computeContentStructureSignature(canonical.content),
      newParentGroupId: canonical.parentId
        ? (groupIdByPageId.get(canonical.parentId) ?? null)
        : null,
    });
  }

  for (const { groupId, siteId, canonical } of resolvedGroups) {
    await tx.insert(pageGroups).values({
      id: groupId,
      tenantId,
      siteId,
      parentId: null,
      content: canonical.content,
      order: canonical.order,
      createdBy: canonical.createdBy,
      createdAt: canonical.createdAt,
      updatedAt: canonical.updatedAt,
    });
  }
  for (const { groupId, newParentGroupId } of resolvedGroups) {
    if (newParentGroupId === null) continue;
    await tx
      .update(pageGroups)
      .set({ parentId: newParentGroupId })
      .where(eq(pageGroups.id, groupId));
  }

  for (const {
    groupId,
    siteId,
    canonical,
    canonicalSignature,
    newParentGroupId,
  } of resolvedGroups) {
    const groupPages = pagesByGroup.get(groupId) as OldPageRow[];

    await tx.insert(pageGroupVersions).values({
      id: randomUUID(),
      tenantId,
      pageGroupId: groupId,
      content: canonical.content,
      createdBy: canonical.createdBy,
      createdAt: canonical.updatedAt,
    });
    groupsCreated += 1;

    for (const page of groupPages) {
      const isCanonical = page.id === canonical.id;
      const signature = isCanonical
        ? canonicalSignature
        : computeContentStructureSignature(page.content);
      const isDiverged = signature !== canonicalSignature;
      const fieldValues =
        !isCanonical && !isDiverged
          ? extractFieldValues(page.content, canonical.content)
          : {};

      const translationId = randomUUID();
      await tx.insert(pageTranslations).values({
        id: translationId,
        tenantId,
        siteId,
        pageGroupId: groupId,
        parentGroupId: newParentGroupId,
        locale: page.locale,
        slug: page.slug,
        seoMeta: page.seoMeta,
        fieldValues,
        status: page.status,
        // Copiato verbatim, mai ricalcolato: preserva esattamente ciò che
        // è già live sul sito pubblico. Il merge struttura+fieldValues
        // entra in gioco solo dalla PROSSIMA publish() reale in avanti.
        publishedSnapshot: page.publishedContent,
        isDiverged,
        divergedContent: isDiverged ? page.content : null,
        createdBy: page.createdBy,
        createdAt: page.createdAt,
        updatedAt: page.updatedAt,
      });
      await tx.insert(pageTranslationVersions).values({
        id: randomUUID(),
        tenantId,
        pageTranslationId: translationId,
        fieldValues,
        seoMeta: page.seoMeta,
        createdBy: page.createdBy,
        createdAt: page.updatedAt,
      });
      translationsCreated += 1;
      if (isDiverged) divergedCount += 1;
    }
  }
}

async function main(): Promise<void> {
  const db: BriskDb = createAppDb();

  try {
    const allTenants = await db.select({ id: tenants.id }).from(tenants);
    for (const tenant of allTenants) {
      await withTenant(db, tenant.id, (tx) => backfillTenant(tx, tenant.id));
    }

    console.log(
      `Backfill page_groups/page_translations completato: ${groupsCreated} gruppi, ${translationsCreated} traduzioni (${divergedCount} già scollegate per drift strutturale pre-esistente), ${allTenants.length} tenant.`,
    );
  } finally {
    // Sempre chiusa, anche in errore — senza questo il pool di connessioni
    // tiene vivo il processo Node indefinitamente dopo un errore a metà
    // transazione, che sembra un hang invece di un fallimento chiaro.
    await db.$client.end();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
