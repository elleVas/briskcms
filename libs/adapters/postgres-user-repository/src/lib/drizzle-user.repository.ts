import { and, eq } from 'drizzle-orm';
import { User, type UserProps } from '@brisk/domain-core';
import type { UserRepositoryPort } from '@brisk/ports';
import { type BriskDb, users, withTenant } from '@brisk/postgres-db';

function toRow(props: UserProps) {
  return {
    id: props.id,
    tenantId: props.tenantId,
    email: props.email,
    passwordHash: props.passwordHash,
    role: props.role,
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

  async save(user: User): Promise<void> {
    const row = toRow(user.toProps());
    await withTenant(this.db, row.tenantId, (tx) =>
      tx
        .insert(users)
        .values(row)
        .onConflictDoUpdate({ target: users.id, set: row }),
    );
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
}
