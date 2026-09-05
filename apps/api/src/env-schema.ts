import { z } from 'zod';

/**
 * Every env var apps/api needs to boot, validated together in one place
 * instead of discovered one `requireEnv()` call at a time as each NestJS
 * module/factory happens to run — a deployment missing three variables
 * used to fail on the first one, get fixed, restart, fail on the second,
 * and so on. `validateApiEnv()` (called first thing in main.ts, before
 * `NestFactory.create()`) reports every problem at once.
 *
 * This does NOT replace the individual `requireEnv()` calls scattered
 * across factories/modules (`media.module.ts`, `auth.module.ts`, etc.) —
 * those stay as the actual typed accessors at the point of use. This is
 * an additional, earlier gate: by the time any of those calls run, this
 * schema has already guaranteed they'll succeed.
 *
 * Deliberately scoped to apps/api's own runtime needs only — not
 * `apps/editor-app` (Vite build-time `VITE_*` vars) or `apps/public-site`
 * (its own separate runtime), and not `POSTGRES_PASSWORD`/
 * `DEFAULT_USER_EMAIL`/`DEFAULT_USER_PASSWORD` (only used by the one-off
 * `db:seed`/migration scripts, a different process entirely, never read by
 * this app at runtime).
 */
const apiEnvBaseSchema = z.object({
  POSTGRES_APP_PASSWORD: z.string().min(1),
  // Optional since the first-run wizard: a self-hosted deployment that has
  // never been set up has no tenant to name here, and DeploymentTenantResolver
  // falls back to the single row in `tenants`. Still honoured when present —
  // development and the integration tests both pin it.
  DEFAULT_TENANT_ID: z.string().uuid().optional(),
  // Optional for the same reason, and read by DeploymentSiteResolver:
  // which site this deployment edits. Only needed for the one topology
  // where the tenant owns more than one (docs/adr/0032) — otherwise the
  // resolver takes the tenant's only site, which is what lets a
  // wizard-created deployment need no site id anywhere.
  DEFAULT_SITE_ID: z.string().uuid().optional(),
  PREVIEW_TOKEN_SECRET: z.string().min(1),
  EDITOR_APP_URL: z.string().url(),
  SMTP_HOST: z.string().min(1),
  SMTP_PORT: z.coerce.number().int().positive(),
  SMTP_FROM_ADDRESS: z.string().min(1),
  MEDIA_UPLOAD_DIR: z.string().min(1),
  API_PUBLIC_URL: z.string().url(),
  // docs/adr/0042 — where FilesystemThemeCatalogAdapter scans for bundled
  // themes; see libs/adapters/filesystem-theme-catalog's own README for why
  // this differs between local dev and this app's pruned production image.
  THEMES_DIR: z.string().min(1),
  TURNSTILE_SECRET_KEY: z.string().min(1),
  // Both groups below are opt-in (ADR-0013's LocalDisk-by-default, and
  // "no NEWSLETTER_PROVIDER = newsletter signup is a harmless no-op") —
  // their own variables are only required once the provider is actually
  // selected, enforced in the `superRefine` below, not by making them
  // required here unconditionally.
  MEDIA_STORAGE_PROVIDER: z.enum(['local', 's3']).default('local'),
  S3_MEDIA_BUCKET: z.string().optional(),
  S3_MEDIA_REGION: z.string().optional(),
  S3_MEDIA_ACCESS_KEY_ID: z.string().optional(),
  S3_MEDIA_SECRET_ACCESS_KEY: z.string().optional(),
  S3_MEDIA_PUBLIC_BASE_URL: z.string().optional(),
  NEWSLETTER_PROVIDER: z.enum(['mailchimp', 'brevo']).optional(),
  MAILCHIMP_API_KEY: z.string().optional(),
  MAILCHIMP_AUDIENCE_ID: z.string().optional(),
  BREVO_API_KEY: z.string().optional(),
  BREVO_LIST_ID: z.string().optional(),
});

const S3_REQUIRED_KEYS = [
  'S3_MEDIA_BUCKET',
  'S3_MEDIA_REGION',
  'S3_MEDIA_ACCESS_KEY_ID',
  'S3_MEDIA_SECRET_ACCESS_KEY',
  'S3_MEDIA_PUBLIC_BASE_URL',
] as const;

const MAILCHIMP_REQUIRED_KEYS = [
  'MAILCHIMP_API_KEY',
  'MAILCHIMP_AUDIENCE_ID',
] as const;
const BREVO_REQUIRED_KEYS = ['BREVO_API_KEY', 'BREVO_LIST_ID'] as const;

export const apiEnvSchema = apiEnvBaseSchema.superRefine((env, ctx) => {
  if (env.MEDIA_STORAGE_PROVIDER === 's3') {
    for (const key of S3_REQUIRED_KEYS) {
      if (!env[key]) {
        ctx.addIssue({
          code: 'custom',
          path: [key],
          message: `${key} is required when MEDIA_STORAGE_PROVIDER=s3`,
        });
      }
    }
  }
  if (env.NEWSLETTER_PROVIDER === 'mailchimp') {
    for (const key of MAILCHIMP_REQUIRED_KEYS) {
      if (!env[key]) {
        ctx.addIssue({
          code: 'custom',
          path: [key],
          message: `${key} is required when NEWSLETTER_PROVIDER=mailchimp`,
        });
      }
    }
  }
  if (env.NEWSLETTER_PROVIDER === 'brevo') {
    for (const key of BREVO_REQUIRED_KEYS) {
      if (!env[key]) {
        ctx.addIssue({
          code: 'custom',
          path: [key],
          message: `${key} is required when NEWSLETTER_PROVIDER=brevo`,
        });
      }
    }
  }
});

/** Throws one Error listing every missing/invalid variable, not just the first. */
export function validateApiEnv(env: NodeJS.ProcessEnv = process.env): void {
  const result = apiEnvSchema.safeParse(env);
  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    throw new Error(
      `Invalid or missing environment variables:\n${issues}\n\n` +
        'Set them in the .env this deployment reads, then restart. For local ' +
        'development that file comes from .env.example (docs/development.md); ' +
        'for a self-hosted deployment from .env.prod.example ' +
        '(docs/self-hosting.md). They can also be exported directly.',
    );
  }
}
