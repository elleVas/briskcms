export type UserRole = 'admin' | 'publisher' | 'editor';

export interface UserProps {
  id: string;
  tenantId: string;
  email: string;
  /** Null for a user created before this field existed — callers fall back to `email` for display, same pattern used elsewhere in this codebase for a denormalized label that predates its own column. */
  displayName: string | null;
  passwordHash: string;
  role: UserRole;
  /**
   * False for a freshly-invited user who hasn't accepted yet (a random,
   * unguessable passwordHash is set at invite time — this flag is the
   * real gate, not "no password set"), and for an admin-deactivated user.
   * Checked on every guarded request (RolesGuard), not just at login, so
   * deactivating someone ends their access immediately, not just blocks
   * their next sign-in.
   */
  isActive: boolean;
  emailVerifiedAt: Date | null;
  createdAt: Date;
}

export interface CreateUserProps {
  id: string;
  tenantId: string;
  email: string;
  displayName: string;
  passwordHash: string;
  role: UserRole;
  /** Defaults to true — only the invite flow creates a user that starts inactive (isActive: false) until accepted. */
  isActive?: boolean;
  now?: Date;
}

export class User {
  private constructor(private props: UserProps) {}

  static create(input: CreateUserProps): User {
    return new User({
      id: input.id,
      tenantId: input.tenantId,
      email: input.email,
      displayName: input.displayName,
      passwordHash: input.passwordHash,
      role: input.role,
      isActive: input.isActive ?? true,
      emailVerifiedAt: null,
      createdAt: input.now ?? new Date(),
    });
  }

  static fromProps(props: UserProps): User {
    return new User({ ...props });
  }

  toProps(): UserProps {
    return { ...this.props };
  }

  get id(): string {
    return this.props.id;
  }

  get tenantId(): string {
    return this.props.tenantId;
  }

  get email(): string {
    return this.props.email;
  }

  get displayName(): string | null {
    return this.props.displayName;
  }

  get passwordHash(): string {
    return this.props.passwordHash;
  }

  get role(): UserRole {
    return this.props.role;
  }

  get isActive(): boolean {
    return this.props.isActive;
  }

  get emailVerifiedAt(): Date | null {
    return this.props.emailVerifiedAt;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get isEmailVerified(): boolean {
    return this.props.emailVerifiedAt !== null;
  }

  verifyEmail(now: Date = new Date()): void {
    this.props.emailVerifiedAt = now;
  }

  changePasswordHash(passwordHash: string): void {
    this.props.passwordHash = passwordHash;
  }

  changeRole(role: UserRole): void {
    this.props.role = role;
  }

  changeDisplayName(displayName: string): void {
    this.props.displayName = displayName;
  }

  /** Ends this user's access immediately (RolesGuard rejects every subsequent request) — does not by itself invalidate already-open sessions; callers that need that (e.g. the deactivate-user use-case) call AuthPort.invalidateAllSessionsForUser separately, same split of responsibility as resetPassword. */
  deactivate(): void {
    this.props.isActive = false;
  }

  /** Also used to accept an invite (the same "isActive: false -> true" transition), not just to undo a deactivation — see the isActive doc comment above. */
  reactivate(): void {
    this.props.isActive = true;
  }
}
