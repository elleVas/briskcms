import { and, eq } from 'drizzle-orm';
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
  DrizzlePaginatedRepository,
  type BriskDb,
  type BriskTx,
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
export class DrizzleUserRepository
  extends DrizzlePaginatedRepository<typeof users.$inferSelect, User>
  implements UserRepositoryPort
{
  protected readonly table = users;
  protected readonly idColumn = users.id;
  protected readonly tenantIdColumn = users.tenantId;

  constructor(db: BriskDb) {
    super(db);
  }

  protected toRow(user: User) {
    return toRow(user.toProps());
  }

  protected fromRow(row: typeof users.$inferSelect): User {
    return fromRow(row);
  }

  /**
   * `onConflictDoUpdate` copre solo un conflitto sulla PK (`id`, un UUID
   * appena generato) — un conflitto sull'UNIQUE(tenant_id, email) risale
   * comunque come `PostgresError` grezzo sotto concorrenza reale (due
   * inviti/registrazioni quasi simultanee sulla stessa email superano
   * entrambe il check-then-act dell'use-case). Tradotto nello stesso errore
   * di dominio che l'use-case già lancia nel caso comune.
   */
  override async save(user: User): Promise<void> {
    const row = this.toRow(user);
    try {
      await withTenant(this.db, row.tenantId, (tx: BriskTx) =>
        this.upsertTx(tx, row),
      );
    } catch (error) {
      if (isUniqueViolation(error, EMAIL_UNIQUE_CONSTRAINT)) {
        throw new UserEmailAlreadyExistsError(row.email);
      }
      throw error;
    }
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
    return this.listPaginatedTx(
      tenantId,
      eq(users.tenantId, tenantId),
      users.createdAt,
      pagination,
    );
  }
}
