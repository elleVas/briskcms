import { z } from 'zod';

/**
 * A form's field definitions — shared between the admin form builder
 * (editor-app), the public-facing renderer (apps/public-site, which
 * fetches a form's fields live at render time, see docs/adr/0015) and
 * submission validation (the payload must match these field ids/types).
 * Curated set for v1 — no conditional logic or multi-page forms (Gravity
 * Forms has those; this deliberately doesn't yet).
 */
export const formFieldTypeSchema = z.enum([
  'text',
  'email',
  'textarea',
  'tel',
  'checkbox',
  'select',
  // Renders and submits exactly like a checkbox (Form.astro) — the only
  // difference is submitForm's own handling: if checked, the submission's
  // email (the form's first `email`-typed field) gets subscribed via
  // NewsletterPort. Not a separate value shape, just a marker on an
  // otherwise-ordinary checkbox field.
  'newsletter-consent',
  // Two separate types, not one combined "datetime" — a booking form
  // might want just a time slot, an event RSVP just a date; each maps to
  // its own native <input type="date"|"time"> (Form.astro), no picker
  // library needed.
  'date',
  'time',
  // Submits as `{ url, filename }` (formFieldFileValueSchema below), not a
  // plain string like every other field type — uploaded separately, before
  // the main submission JSON POST (apps/public-site's submit proxy),
  // through AttachmentStoragePort (raw byte storage, no image processing —
  // see @brisk/ports' own comment on that port for why this can't reuse
  // MediaStoragePort, which is dedicated to the curated, image-only media
  // library).
  'file',
]);
export type FormFieldType = z.infer<typeof formFieldTypeSchema>;

/** The value shape a submitted `file`-typed field carries in a submission's payload — see formFieldTypeSchema's own comment on `'file'`. */
export const formFieldFileValueSchema = z.object({
  url: z.string(),
  filename: z.string(),
});
export type FormFieldFileValue = z.infer<typeof formFieldFileValueSchema>;

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
