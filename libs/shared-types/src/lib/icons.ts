import { z } from 'zod';

/**
 * Una singola icona risolta dal tema attivo (docs/adr/0023) — `svg` è il
 * markup grezzo (niente riferimento a file, editor-app e apps/public-site
 * sono due applicazioni separate e non condividono un filesystem a runtime).
 */
export const iconEntrySchema = z.object({
  name: z.string().min(1),
  svg: z.string().min(1),
});
export type IconEntry = z.infer<typeof iconEntrySchema>;

/** Corpo di risposta di `GET /api/themes/current/icons` (apps/public-site). */
export const iconManifestSchema = z.array(iconEntrySchema);
export type IconManifest = z.infer<typeof iconManifestSchema>;
