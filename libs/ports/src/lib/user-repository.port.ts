import type { User } from '@brisk/domain-core';
import type { PaginatedResult, Pagination } from './pagination';

/**
 * Every method requires tenantId explicitly: no query can "forget" its
 * per-tenant scoping at the Port's signature level, even though the
 * concrete adapter also relies on RLS as a second barrier.
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
  /**
   * How many admins of this tenant can still sign in.
   *
   * A count, not a listing, because the only question asked of it is
   * "would this change leave zero" — see LastActiveAdminError. Paging
   * through every user to count them in memory would answer the same
   * question by reading the whole table.
   */
  countActiveAdmins(tenantId: string): Promise<number>;
}
