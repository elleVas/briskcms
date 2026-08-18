import { z } from 'zod';

/**
 * Formato generico di un blocco di contenuto (output editor Puck, Fase 2).
 * Ogni tipo di blocco concreto (Hero, Testo, ...) definirà il proprio schema
 * per `props` — questo resta lo shape strutturale condiviso fino a quel momento.
 *
 * `children` è il nostro schema di nesting, indipendente dal formato nativo
 * di Puck (root/content/zones) — vedi docs/adr/0007. Il mapping layer in
 * editor-app converte le drop-zone di Puck in/da `children`, così restiamo
 * capaci di supportare blocchi "contenitore" senza accoppiare dominio e DB
 * al formato interno di una libreria terza.
 */
export interface Block {
  type: string;
  props: Record<string, unknown>;
  children?: Block[];
}

export const blockSchema: z.ZodType<Block> = z.lazy(() =>
  z.object({
    type: z.string(),
    props: z.record(z.string(), z.unknown()),
    children: z.array(blockSchema).optional(),
  }),
);

export const pageContentSchema = z.array(blockSchema);
export type PageContent = z.infer<typeof pageContentSchema>;

export const seoMetaSchema = z.object({
  title: z.string(),
  description: z.string(),
  ogTags: z.record(z.string(), z.string()).optional(),
  canonical: z.string().optional(),
});
export type SeoMeta = z.infer<typeof seoMetaSchema>;

/**
 * Per-block-type prop schemas, one per concrete block (Hero, Text, ...).
 * Kept here rather than in `@brisk/puck-config` so apps/public-site can
 * import them without pulling in Puck/React at all (see docs/adr/0007 —
 * "any consumer of page content that isn't the editor... can walk children
 * directly without knowing anything about Puck"). `@brisk/puck-config`
 * imports these same schemas and wraps them in Puck's `ComponentConfig` for
 * the editor; this file is the single source of truth for each block's
 * shape either way.
 */
export const heroPropsSchema = z.object({
  title: z.string(),
  subtitle: z.string(),
});
export type HeroProps = z.infer<typeof heroPropsSchema>;

export const textPropsSchema = z.object({
  body: z.string(),
});
export type TextProps = z.infer<typeof textPropsSchema>;
