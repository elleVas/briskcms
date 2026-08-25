import { and, count, desc, eq } from 'drizzle-orm';
import {
  User,
  UserEmailAlreadyExistsError,
  type UserProps,
} from '@brisk/domain-core';
import type {
  PaginatedResult,
  Pagination,
  UserRepositoryPort,
} from '@brisk/ports';
import {
  type BriskDb,
  isUniqueViolation,
  users,
  withTenant,
} from '@brisk/postgres-db';

const EMAIL_UNIQUE_CONSTRAINT = 'users_tenant_id_email_unique';

function toRow(props: UserProps) {
  return {
    id: props.id,
    tenantId: props.tenantId,
    email: props.email,
    displayName: props.displayName,
    passwordHash: props.passwordHash,
    role: props.role,
    isActive: props.isActive,
    emailVerifiedAt: props.emailVerifiedAt,
    createdAt: props.createdAt,
  };
}

function fromRow(row: typeof users.$inferSelect): User {
  return User.fromProps(row);
}

/** Connects as `brisk_app` — see docs/adr/0002-non-superuser-role-for-rls-enforcement.md. */
export class DrizzleUserRepository implements UserRepositoryPort {
  constructor(private readonly db: BriskDb) {}

  /**
   * `onConflictDoUpdate` copre solo un conflitto sulla PK (`id`, un UUID
   * appena generato) — un conflitto sull'UNIQUE(tenant_id, email) risale
   * comunque come `PostgresError` grezzo sotto concorrenza reale (due
   * inviti/registrazioni quasi simultanee sulla stessa email superano
   * entrambe il check-then-act dell'use-case). Tradotto nello stesso errore
   * di dominio che l'use-case già lancia nel caso comune.
   */
  async save(user: User): Promise<void> {
    const row = toRow(user.toProps());
    try {
      await withTenant(this.db, row.tenantId, (tx) =>
        tx
          .insert(users)
          .values(row)
          .onConflictDoUpdate({ target: users.id, set: row }),
      );
    } catch (error) {
      if (isUniqueViolation(error, EMAIL_UNIQUE_CONSTRAINT)) {
        throw new UserEmailAlreadyExistsError(row.email);
      }
      throw error;
    }
  }

  async findById(tenantId: string, userId: string): Promise<User | null> {
    const rows = await withTenant(this.db, tenantId, (tx) =>
      tx
        .select()
        .from(users)
        .where(and(eq(users.tenantId, tenantId), eq(users.id, userId)))
        .limit(1),
    );
    return rows[0] ? fromRow(rows[0]) : null;
  }

  async findByEmail(tenantId: string, email: string): Promise<User | null> {
    const rows = await withTenant(this.db, tenantId, (tx) =>
      tx
        .select()
        .from(users)
        .where(and(eq(users.tenantId, tenantId), eq(users.email, email)))
        .limit(1),
    );
    return rows[0] ? fromRow(rows[0]) : null;
  }

  /** Most recently created first — matches PageRepositoryPort.listBySite's own convention. */
  async list(
    tenantId: string,
    pagination: Pagination,
  ): Promise<PaginatedResult<User>> {
    const tenantScope = eq(users.tenantId, tenantId);
    const [rows, [{ total }]] = await withTenant(this.db, tenantId, (tx) =>
      Promise.all([
        tx
          .select()
          .from(users)
          .where(tenantScope)
          .orderBy(desc(users.createdAt))
          .limit(pagination.pageSize)
          .offset((pagination.page - 1) * pagination.pageSize),
        tx.select({ total: count() }).from(users).where(tenantScope),
      ]),
    );
    return { items: rows.map(fromRow), total };
  }
}
