import { validateApiEnv } from './env-schema';

const VALID_ENV: NodeJS.ProcessEnv = {
  POSTGRES_APP_PASSWORD: 'app-password',
  DEFAULT_TENANT_ID: '31329174-2ede-4151-be9d-a3e765d21e1f',
  PREVIEW_TOKEN_SECRET: 'preview-secret',
  EDITOR_APP_URL: 'http://localhost:4200',
  SMTP_HOST: 'localhost',
  SMTP_PORT: '1025',
  SMTP_FROM_ADDRESS: 'noreply@brisk.local',
  MEDIA_UPLOAD_DIR: './uploads',
  API_PUBLIC_URL: 'http://localhost:3000/api',
  TURNSTILE_SECRET_KEY: 'turnstile-secret',
  THEMES_DIR: './themes',
};

describe('validateApiEnv', () => {
  it('passes with only the always-required variables set (LocalDisk media, no newsletter provider)', () => {
    expect(() => validateApiEnv(VALID_ENV)).not.toThrow();
  });

  it('reports every missing variable in one error, not just the first', () => {
    expect(() => validateApiEnv({})).toThrow(
      /POSTGRES_APP_PASSWORD[\s\S]*PREVIEW_TOKEN_SECRET[\s\S]*EDITOR_APP_URL/,
    );
  });

  it('accepts a missing DEFAULT_TENANT_ID', () => {
    // Optional since the first-run wizard: a deployment that has never been
    // set up has no tenant to name, and DeploymentTenantResolver falls back
    // to the single row in `tenants`.
    const { DEFAULT_TENANT_ID: _omitted, ...withoutTenantId } = VALID_ENV;

    expect(() => validateApiEnv(withoutTenantId)).not.toThrow();
  });

  it('rejects a malformed DEFAULT_TENANT_ID (not a uuid)', () => {
    expect(() =>
      validateApiEnv({ ...VALID_ENV, DEFAULT_TENANT_ID: 'not-a-uuid' }),
    ).toThrow(/DEFAULT_TENANT_ID/);
  });

  it('does not require S3 variables when MEDIA_STORAGE_PROVIDER is unset (LocalDisk default)', () => {
    expect(() => validateApiEnv(VALID_ENV)).not.toThrow();
  });

  it('requires every S3 variable once MEDIA_STORAGE_PROVIDER=s3', () => {
    expect(() =>
      validateApiEnv({ ...VALID_ENV, MEDIA_STORAGE_PROVIDER: 's3' }),
    ).toThrow(/S3_MEDIA_BUCKET[\s\S]*S3_MEDIA_REGION/);
  });

  it('passes with MEDIA_STORAGE_PROVIDER=s3 once all S3 variables are set', () => {
    expect(() =>
      validateApiEnv({
        ...VALID_ENV,
        MEDIA_STORAGE_PROVIDER: 's3',
        S3_MEDIA_BUCKET: 'brisk-media',
        S3_MEDIA_REGION: 'us-east-1',
        S3_MEDIA_ACCESS_KEY_ID: 'key',
        S3_MEDIA_SECRET_ACCESS_KEY: 'secret',
        S3_MEDIA_PUBLIC_BASE_URL: 'http://localhost:9000/brisk-media',
      }),
    ).not.toThrow();
  });

  it('requires MAILCHIMP_API_KEY/MAILCHIMP_AUDIENCE_ID once NEWSLETTER_PROVIDER=mailchimp', () => {
    expect(() =>
      validateApiEnv({ ...VALID_ENV, NEWSLETTER_PROVIDER: 'mailchimp' }),
    ).toThrow(/MAILCHIMP_API_KEY[\s\S]*MAILCHIMP_AUDIENCE_ID/);
  });

  it('requires BREVO_API_KEY/BREVO_LIST_ID once NEWSLETTER_PROVIDER=brevo', () => {
    expect(() =>
      validateApiEnv({ ...VALID_ENV, NEWSLETTER_PROVIDER: 'brevo' }),
    ).toThrow(/BREVO_API_KEY[\s\S]*BREVO_LIST_ID/);
  });
});
