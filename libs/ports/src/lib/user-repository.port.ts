import type { User } from '@brisk/domain-core';
import type { PaginatedResult, Pagination } from './pagination';

/**
 * Ogni metodo richiede esplicitamente tenantId: nessuna query può
 * "dimenticare" lo scoping per tenant a livello di firma del Port,
 * anche se l'adapter concreto si affida anche a RLS come seconda barriera.
 */
export interface UserRepositoryPort {
  save(user: User): Promise<void>;
  findById(tenantId: string, userId: string): Promise<User | null>;
  findByEmail(tenantId: string, email: string): Promise<User | null>;
  /** Same Pagination/PaginatedResult shape as PageRepositoryPort.listBySite — the "Utenti" section (Fase 5c) needed a listing the same way Pages did before GET /pages existed. */
  list(
    tenantId: string,
    pagination: Pagination,
  ): Promise<PaginatedResult<User>>;
}
