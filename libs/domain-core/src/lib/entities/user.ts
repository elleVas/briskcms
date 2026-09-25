import type { UserRole } from '@brisk/shared-types';

export type { UserRole };

/**
 * A profile picture, stored like an uploaded image (re-encoded, ADR-0013)
 * but kept out of the site's library: it belongs to the person, not to a
 * site, and deleting a picture from the library must not be able to take
 * someone's face with it.
 */
export interface UserAvatar {
  storageKey: string;
  width: number | null;
  height: number | null;
}

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
  /**
   * The last segment of the person's author page, `/it/autore/{slug}`.
   *
   * `null` until they have a display name: a slug made from an email
   * address would publish part of it. Once given it does NOT follow the
   * name — renaming yourself must not break every link to your articles —
   * and changes only when the person changes it.
   */
  slug: string | null;
  /** Addresses this person's page answered at before, each a 301 to the current one — the same promise a renamed page keeps (PR #180). */
  formerSlugs: string[];
  /** A few lines about them, one entry per language of the site, keyed by locale. */
  bio: Record<string, string>;
  avatar: UserAvatar | null;
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
  /** Chosen by the caller, which is the one that can check it is free. */
  slug?: string | null;
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
      slug: input.slug ?? null,
      formerSlugs: [],
      bio: {},
      avatar: null,
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

  get slug(): string | null {
    return this.props.slug;
  }

  get formerSlugs(): readonly string[] {
    return this.props.formerSlugs;
  }

  get bio(): Readonly<Record<string, string>> {
    return this.props.bio;
  }

  get avatar(): UserAvatar | null {
    return this.props.avatar;
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

  /** `null` clears it: the person then has no byline and no author page, though their address stays reserved for them. */
  changeDisplayName(displayName: string | null): void {
    this.props.displayName = displayName;
  }

  /** Ends this user's access immediately (RolesGuard rejects every subsequent request) — does not by itself invalidate already-open sessions; callers that need that (e.g. the deactivate-user use-case) call AuthPort.invalidateAllSessionsForUser separately, same split of responsibility as resetPassword. */
  deactivate(): void {
    this.props.isActive = false;
  }

  /**
   * Moves the author page to a new address and remembers the old one —
   * `PageTranslation.updateSlug`'s rule: going back to an address this
   * person already had takes it out of the history, so a slug is never
   * both the answer and a redirect to itself. The first slug, given to
   * someone who had none, leaves nothing behind.
   */
  changeSlug(slug: string): void {
    if (slug === this.props.slug) return;
    const previous = this.props.slug;
    this.props.formerSlugs = [
      ...this.props.formerSlugs.filter((former) => former !== slug),
      ...(previous ? [previous] : []),
    ];
    this.props.slug = slug;
  }

  /** Blank entries are dropped: a language with nothing written in it has no bio, not an empty one. */
  changeBio(bio: Record<string, string>): void {
    this.props.bio = Object.fromEntries(
      Object.entries(bio)
        .map(([locale, text]) => [locale, text.trim()] as const)
        .filter(([, text]) => text !== ''),
    );
  }

  /** Returns the picture it replaces, for the caller to delete from storage. */
  changeAvatar(avatar: UserAvatar | null): UserAvatar | null {
    const previous = this.props.avatar;
    this.props.avatar = avatar;
    return previous;
  }

  /** Also used to accept an invite (the same "isActive: false -> true" transition), not just to undo a deactivation — see the isActive doc comment above. */
  reactivate(): void {
    this.props.isActive = true;
  }
}
