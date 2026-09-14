import type { User } from '@brisk/domain-core';
import type { PaginatedResult, Pagination } from './pagination';

/**
 * Every method requires tenantId explicitly: no query can "forget" its
 * per-tenant scoping at the Port's signature level, even though the
 * concrete adapter also relies on RLS as a second barrier.
 */
export interface UserRepositoryPort {
  save(user: User): Promise<void>;
  /**
   * Writes what a person says about themselves — name, address (with the
   * ones they left) and bio — and nothing else of the row.
   *
   * Not `save`: that writes every column as it was READ, so a profile saved
   * a moment after an admin changed the person's role, or switched them
   * off, would quietly put the old role or status back.
   */
  saveProfile(user: User): Promise<void>;
  /** Writes the picture alone, for the same reason as `saveProfile` — a name saved while a picture uploads must not bring the old picture back. */
  saveAvatar(user: User): Promise<void>;
  findById(tenantId: string, userId: string): Promise<User | null>;
  findByEmail(tenantId: string, email: string): Promise<User | null>;
  /** The person whose author page is at this address now. */
  findBySlug(tenantId: string, slug: string): Promise<User | null>;
  /** The person whose author page used to be at this address — what a 301 is sent on to. */
  findByFormerSlug(tenantId: string, slug: string): Promise<User | null>;
  /**
   * Whether another person already answers at this address, as their
   * current one or as a former one still redirecting. A former address is
   * taken too: giving it to someone else would silently turn a redirect
   * that works into a page about the wrong person.
   */
  isSlugTaken(
    tenantId: string,
    slug: string,
    exceptUserId: string | null,
  ): Promise<boolean>;
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
