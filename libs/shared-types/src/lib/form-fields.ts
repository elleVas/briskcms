import { z } from 'zod';

/**
 * A form's field definitions — shared between the admin form builder
 * (editor-app), the public-facing renderer (apps/public-site, which
 * fetches a form's fields live at render time, see docs/adr/0015) and
 * submission validation (the payload must match these field ids/types).
 * Curated set for v1 — no file upload, conditional logic, or multi-page
 * forms (Gravity Forms has all of those; this deliberately doesn't yet).
 */
export const formFieldTypeSchema = z.enum([
  'text',
  'email',
  'textarea',
  'tel',
  'checkbox',
  'select',
]);
export type FormFieldType = z.infer<typeof formFieldTypeSchema>;

export const formFieldSchema = z.object({
  // Stable per-field id, independent of display order — this is the key
  // a submission's payload is keyed by, so reordering fields in the
  // builder never silently remaps past submissions to the wrong field.
  id: z.string(),
  label: z.string().min(1),
  type: formFieldTypeSchema,
  required: z.boolean(),
  // Only meaningful (and only ever populated) for type: 'select'.
  options: z.array(z.string()).optional(),
});
export type FormField = z.infer<typeof formFieldSchema>;

export const formFieldsSchema = z.array(formFieldSchema);
