import { z } from 'zod';

/**
 * Un valore CSS length grezzo (es. "6px", "0.5rem", "9999px" per un pill) —
 * niente unità imposta: lasciare scegliere px/rem/% all'utente invece di
 * forzare un'unica unità è più vicino a come funziona la CSS var che
 * sostituisce a valle (vedi PageLayout.astro). `null` = non personalizzato,
 * eredita il default del tema attivo.
 */
export const cssLengthTokenSchema = z.string().min(1).nullable();

/** Un colore CSS grezzo (qualunque sintassi valida — hex, oklch, var(...)). `null` = non personalizzato. */
export const cssColorTokenSchema = z.string().min(1).nullable();

/**
 * Le proprietà di stile che un blocco può rendere sovrascrivibili — una
 * SOLA forma condivisa da ogni tipo di blocco (docs/adr/0022), non un
 * campo Zod aggiunto a mano per ciascuno dei 48+ tipi: non ogni blocco usa
 * ogni proprietà (un Testo non ha un "border radius" sensato), è
 * `BlockDescriptor.stylableProperties` a dichiarare quali di queste sono
 * effettivamente rilevanti per un dato tipo.
 */
export const blockStyleOverrideSchema = z.object({
  backgroundColor: cssColorTokenSchema.optional(),
  textColor: cssColorTokenSchema.optional(),
  borderRadius: cssLengthTokenSchema.optional(),
  paddingX: cssLengthTokenSchema.optional(),
  paddingY: cssLengthTokenSchema.optional(),
});
export type BlockStyleOverride = z.infer<typeof blockStyleOverrideSchema>;

/**
 * Override "a livello di componente" (docs/adr/0022) — sostituisce la
 * vecchia forma fissa `{ buttons: {...} }` con una mappa generica per
 * tipo di blocco: qualunque tipo può ricevere un override senza
 * richiedere un nuovo campo Zod dedicato ogni volta. Applicato a TUTTE le
 * istanze di quel tipo sul sito — vedi `Block.styleOverride` per
 * l'override della singola istanza.
 */
export const themeTokensSchema = z.object({
  blockStyles: z.record(z.string(), blockStyleOverrideSchema),
});
export type ThemeTokens = z.infer<typeof themeTokensSchema>;

/** Nessun tipo personalizzato — ogni blocco usa i propri default CSS esistenti. */
export const DEFAULT_THEME_TOKENS: ThemeTokens = {
  blockStyles: {},
};

/**
 * Aggiornamento per-tipo (endpoint `PATCH /sites/:id/theme-tokens`): il
 * body porta l'override completo per UN tipo di blocco alla volta (il
 * pulsante "Stile" della toolbar edita sempre il tipo del blocco
 * selezionato) — sostituisce per intero quella voce della mappa, gli
 * altri tipi già salvati restano invariati.
 */
export const updateThemeTokensBodySchema = z.object({
  blockType: z.string().min(1),
  style: blockStyleOverrideSchema,
});
export type UpdateThemeTokensBody = z.infer<typeof updateThemeTokensBodySchema>;

/**
 * Il valore RISOLTO (non un token grezzo) di ogni proprietà stilizzabile
 * per un tipo di blocco, contro il tema attivo — es. `borderRadius:
 * "0.5rem"`, mai `"var(--radius)"` non risolto. A differenza di
 * `BlockStyleOverride`, qui ogni chiave presente ha SEMPRE un valore
 * stringa: non esiste un "default nullo", un blocco stilizzabile ha
 * sempre un aspetto quando non personalizzato, è quell'aspetto che questo
 * tipo cattura. Sorgente: `BlockDescriptor.defaultStyle` (block-registry,
 * l'espressione dichiarata, es. `var(--primary)`) risolto contro il
 * `theme.css` del tema attivo — vedi
 * `apps/public-site/src/lib/resolve-theme-block-style-defaults.ts`.
 */
export const blockStyleDefaultsSchema = z.object({
  backgroundColor: z.string().min(1).optional(),
  textColor: z.string().min(1).optional(),
  borderRadius: z.string().min(1).optional(),
  paddingX: z.string().min(1).optional(),
  paddingY: z.string().min(1).optional(),
});
export type BlockStyleDefaults = z.infer<typeof blockStyleDefaultsSchema>;

/** Corpo di risposta di `GET /api/themes/current/block-style-defaults` (apps/public-site): una entry per tipo di blocco stilizzabile. */
export const blockStyleDefaultsResponseSchema = z.record(
  z.string().min(1),
  blockStyleDefaultsSchema,
);
export type BlockStyleDefaultsResponse = z.infer<
  typeof blockStyleDefaultsResponseSchema
>;
