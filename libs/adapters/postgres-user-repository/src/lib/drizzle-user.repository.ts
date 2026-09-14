import { and, count, eq, ne, or, sql } from 'drizzle-orm';
import {
  User,
  UserEmailAlreadyExistsError,
  UserSlugAlreadyExistsError,
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
const SLUG_UNIQUE_CONSTRAINT = 'users_tenant_id_slug_unique';

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
    slug: props.slug,
    formerSlugs: props.formerSlugs,
    bio: props.bio,
    avatarStorageKey: props.avatar?.storageKey ?? null,
    avatarWidth: props.avatar?.width ?? null,
    avatarHeight: props.avatar?.height ?? null,
  };
}

function fromRow(row: typeof users.$inferSelect): User {
  const { avatarStorageKey, avatarWidth, avatarHeight, ...rest } = row;
  return User.fromProps({
    ...rest,
    avatar: avatarStorageKey
      ? {
          storageKey: avatarStorageKey,
          width: avatarWidth,
          height: avatarHeight,
        }
      : null,
  });
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
   * `onConflictDoUpdate` only covers a conflict on the PK (`id`, a
   * freshly generated UUID) — a conflict on UNIQUE(tenant_id, email) still
   * surfaces as a raw `PostgresError` under real concurrency (two
   * near-simultaneous invites or registrations for the same email both
   * passing the use case's check-then-act). Translated into the same domain
   * error the use case already throws in the common case.
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
      // The use case checks first; this is the race two people saving the
      // same address at the same moment would otherwise win silently.
      if (row.slug && isUniqueViolation(error, SLUG_UNIQUE_CONSTRAINT)) {
        throw new UserSlugAlreadyExistsError(row.slug);
      }
      throw error;
    }
  }

  async saveProfile(user: User): Promise<void> {
    const props = user.toProps();
    try {
      await withTenant(this.db, props.tenantId, (tx: BriskTx) =>
        tx
          .update(users)
          .set({
            displayName: props.displayName,
            slug: props.slug,
            formerSlugs: props.formerSlugs,
            bio: props.bio,
          })
          .where(
            and(eq(users.tenantId, props.tenantId), eq(users.id, props.id)),
          ),
      );
    } catch (error) {
      if (props.slug && isUniqueViolation(error, SLUG_UNIQUE_CONSTRAINT)) {
        throw new UserSlugAlreadyExistsError(props.slug);
      }
      throw error;
    }
  }

  async saveAvatar(user: User): Promise<void> {
    const { tenantId, id, avatar } = user.toProps();
    await withTenant(this.db, tenantId, (tx: BriskTx) =>
      tx
        .update(users)
        .set({
          avatarStorageKey: avatar?.storageKey ?? null,
          avatarWidth: avatar?.width ?? null,
          avatarHeight: avatar?.height ?? null,
        })
        .where(and(eq(users.tenantId, tenantId), eq(users.id, id))),
    );
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

  async findBySlug(tenantId: string, slug: string): Promise<User | null> {
    const rows = await withTenant(this.db, tenantId, (tx) =>
      tx
        .select()
        .from(users)
        .where(and(eq(users.tenantId, tenantId), eq(users.slug, slug)))
        .limit(1),
    );
    return rows[0] ? fromRow(rows[0]) : null;
  }

  async findByFormerSlug(tenantId: string, slug: string): Promise<User | null> {
    const rows = await withTenant(this.db, tenantId, (tx) =>
      tx
        .select()
        .from(users)
        .where(
          and(
            eq(users.tenantId, tenantId),
            sql`${users.formerSlugs} @> ARRAY[${slug}]::text[]`,
          ),
        )
        .limit(1),
    );
    return rows[0] ? fromRow(rows[0]) : null;
  }

  async isSlugTaken(
    tenantId: string,
    slug: string,
    exceptUserId: string | null,
  ): Promise<boolean> {
    const rows = await withTenant(this.db, tenantId, (tx) =>
      tx
        .select({ id: users.id })
        .from(users)
        .where(
          and(
            eq(users.tenantId, tenantId),
            ...(exceptUserId ? [ne(users.id, exceptUserId)] : []),
            or(
              eq(users.slug, slug),
              sql`${users.formerSlugs} @> ARRAY[${slug}]::text[]`,
            ),
          ),
        )
        .limit(1),
    );
    return rows.length > 0;
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

  async countActiveAdmins(tenantId: string): Promise<number> {
    const rows = await withTenant(this.db, tenantId, (tx) =>
      tx
        .select({ total: count() })
        .from(users)
        .where(
          and(
            eq(users.tenantId, tenantId),
            eq(users.role, 'admin'),
            eq(users.isActive, true),
          ),
        ),
    );
    return rows[0].total;
  }
}
