/**
 * Exposes the tenant of the current request, set by a NestJS
 * Guard/Interceptor downstream of auth. The Postgres adapters use it to set
 * `app.current_tenant_id` on the database session, so the Row Level
 * Security policies have a value to filter on — the policies live in
 * `libs/adapters/postgres-db/drizzle/`, alongside the schema they guard.
 */
export interface TenantContextPort {
  getCurrentTenantId(): string;
  /** The authenticated user making the current request — same session SessionAuthGuard already validated. */
  getCurrentUserId(): string;
}
