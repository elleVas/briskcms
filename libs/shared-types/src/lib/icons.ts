import { z } from 'zod';

/**
 * A single icon resolved from the active theme (docs/adr/0023) — `svg` is
 * the raw markup (no file reference: editor-app and apps/public-site are
 * two separate applications and share no filesystem at runtime).
 */
export const iconEntrySchema = z.object({
  name: z.string().min(1),
  svg: z.string().min(1),
});
export type IconEntry = z.infer<typeof iconEntrySchema>;

/** Corpo di risposta di `GET /api/themes/current/icons` (apps/public-site). */
export const iconManifestSchema = z.array(iconEntrySchema);
export type IconManifest = z.infer<typeof iconManifestSchema>;
