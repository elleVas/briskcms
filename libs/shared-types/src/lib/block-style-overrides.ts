import type { BlockStyleOverride } from './site-theme-tokens.js';

/**
 * Un solo nome di custom property per campo, condiviso da ogni tipo di
 * blocco (docs/adr/0022) — non un `--button-radius` per Button e un
 * `--card-radius` per un altro tipo: lo stesso `.astro` di un blocco
 * legge sempre `var(--brisk-override-*, <default del tema>)`, quale che
 * sia il tipo, quindi il nome della property non ha bisogno di
 * conoscere il tipo — è la regola CSS che lo scopa già per tipo (vedi
 * `buildBlockStyleOverridesCss` sotto). Vive in shared-types (non solo in
 * apps/public-site) perché editor-app la usa anche lei, per aggiornare
 * dal vivo il `<style>` dentro l'iframe del canvas quando il pulsante
 * "Stile" salva — stessa logica, non duplicata tra le due app.
 */
export const BLOCK_STYLE_CUSTOM_PROPERTIES: Record<
  keyof BlockStyleOverride,
  string
> = {
  backgroundColor: '--brisk-override-bg',
  textColor: '--brisk-override-text',
  borderRadius: '--brisk-override-radius',
  paddingX: '--brisk-override-padding-x',
  paddingY: '--brisk-override-padding-y',
};

/**
 * "Button" -> "brisk-button", "PromoBar" -> "brisk-promo-bar" — la
 * convenzione di classe già seguita a mano da ogni blocco stilizzato
 * (Container.astro's `.brisk-container`, Column.astro's `.brisk-column`,
 * …). Deriva la classe dal TIPO invece di richiedere che ogni blocco la
 * dichiari esplicitamente da qualche parte: un solo posto da tenere
 * coerente con la convenzione, invece di due.
 */
export function blockTypeToClassName(blockType: string): string {
  return `brisk-${blockType.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase()}`;
}

/**
 * Override "a livello di componente" (docs/adr/0022) — una regola CSS per
 * tipo di blocco stilizzato, scoped dalla classe `.brisk-*` del blocco
 * stesso, NON da `[data-brisk-block-type]`: quel wrapper esiste solo
 * quando `editable` è vero (BlockRenderer.astro) — sul sito pubblicato
 * per un visitatore reale non c'è, quindi una regola scoped lì non
 * avrebbe mai effetto fuori dall'editor, l'esatto contrario dello scopo
 * di questa feature. La classe del blocco, invece, è sulla markup reale
 * in ENTRAMBI i contesti. Nessun `!important`: a differenza dei colori/
 * font di Tier 1 (docs/adr/0021), qui non c'è una regola di specificità
 * più alta da battere — il blocco stesso legge
 * `var(--brisk-override-x, <default>)`, quindi qualunque valore la
 * custom property risolva è già quello vincente per costruzione.
 */
export function buildBlockStyleOverridesCss(
  blockStyles: Record<string, BlockStyleOverride>,
): string {
  return Object.entries(blockStyles)
    .map(([blockType, override]) => {
      const declarations = (
        Object.keys(
          BLOCK_STYLE_CUSTOM_PROPERTIES,
        ) as (keyof BlockStyleOverride)[]
      )
        .map((field) => {
          const value = override[field];
          return value
            ? `${BLOCK_STYLE_CUSTOM_PROPERTIES[field]}: ${value};`
            : null;
        })
        .filter((declaration): declaration is string => declaration !== null)
        .join(' ');
      return declarations
        ? `.${blockTypeToClassName(blockType)} { ${declarations} }`
        : null;
    })
    .filter((rule): rule is string => rule !== null)
    .join('\n');
}

/**
 * Override per-istanza (docs/adr/0022) — stesse custom property di sopra,
 * ma come attributo `style` inline sull'elemento REALE del blocco (il
 * componente stesso, es. Button.astro, riceve `styleOverride` come prop
 * in più oltre alle sue — non il wrapper `data-brisk-block-*`, che per lo
 * stesso motivo di `buildBlockStyleOverridesCss` sopra non esiste sul
 * sito pubblicato). Un inline vince sempre sulla regola per-tipo per
 * quello stesso elemento — nessun `!important` qui nemmeno, per lo stesso
 * motivo.
 */
export function buildBlockInstanceStyle(
  override: BlockStyleOverride | undefined,
): string | undefined {
  if (!override) {
    return undefined;
  }
  const declarations = (
    Object.keys(BLOCK_STYLE_CUSTOM_PROPERTIES) as (keyof BlockStyleOverride)[]
  )
    .map((field) => {
      const value = override[field];
      return value
        ? `${BLOCK_STYLE_CUSTOM_PROPERTIES[field]}: ${value};`
        : null;
    })
    .filter((declaration): declaration is string => declaration !== null)
    .join(' ');
  return declarations.length > 0 ? declarations : undefined;
}
