/**
 * Espone il tenant della richiesta corrente (impostato da un Guard/Interceptor
 * NestJS a valle dell'auth). Gli adapter Postgres lo usano per impostare
 * `app.current_tenant_id` a livello di sessione DB, cosi che le policy RLS
 * (vedi db/init/002_rls.sql) abbiano un valore su cui filtrare.
 */
export interface TenantContextPort {
  getCurrentTenantId(): string;
  /** The authenticated user making the current request — same session SessionAuthGuard already validated. */
  getCurrentUserId(): string;
}
