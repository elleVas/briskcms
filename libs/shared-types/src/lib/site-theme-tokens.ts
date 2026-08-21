import { z } from 'zod';

/**
 * Un valore CSS length grezzo (es. "6px", "0.5rem", "9999px" per un pill) —
 * niente unità imposta: lasciare scegliere px/rem/% all'utente invece di
 * forzare un'unica unità è più vicino a come funziona la CSS var che
 * sostituisce a valle (vedi PageLayout.astro). `null` = non personalizzato,
 * eredita il default del tema attivo.
 */
export const cssLengthTokenSchema = z.string().min(1).nullable();

/**
 * Categoria "Bottoni" del Global Styles Editor (piano editor visuale, parte
 * 2, Fase 2a) — la prima categoria di `themeTokens` oltre ai colori
 * esistenti (`ThemeSettings.primaryColor`/`secondaryColor`, che restano
 * lì: non duplicati qui). Ogni nuova categoria futura (Typography, Cards,
 * Tables, Footer — vedi il piano) si aggiunge come nuovo campo opzionale
 * qui accanto, mai sostituendo questo shape.
 */
export const buttonThemeTokensSchema = z.object({
  borderRadius: cssLengthTokenSchema,
  paddingX: cssLengthTokenSchema,
  paddingY: cssLengthTokenSchema,
});
export type ButtonThemeTokens = z.infer<typeof buttonThemeTokensSchema>;

export const themeTokensSchema = z.object({
  buttons: buttonThemeTokensSchema,
});
export type ThemeTokens = z.infer<typeof themeTokensSchema>;

/** Ogni campo `null` — nessuna personalizzazione, ogni blocco usa i propri default CSS esistenti. */
export const DEFAULT_THEME_TOKENS: ThemeTokens = {
  buttons: { borderRadius: null, paddingX: null, paddingY: null },
};

/**
 * Aggiornamento per-categoria (endpoint `PATCH /sites/:id/theme-tokens`):
 * ogni categoria presente nel body sostituisce per intero quella categoria
 * nei token salvati (non un merge campo-per-campo) — semplice e sufficiente
 * finché ogni categoria ha pochi campi tutti editati insieme nello stesso
 * pannello; le categorie ASSENTI dal body restano invariate.
 */
export const updateThemeTokensBodySchema = z.object({
  buttons: buttonThemeTokensSchema.optional(),
});
export type UpdateThemeTokensBody = z.infer<typeof updateThemeTokensBodySchema>;
