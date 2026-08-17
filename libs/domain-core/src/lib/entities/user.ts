export type UserRole = 'admin' | 'editor';

export interface UserProps {
  id: string;
  tenantId: string;
  email: string;
  passwordHash: string;
  role: UserRole;
  emailVerifiedAt: Date | null;
  createdAt: Date;
}

export interface CreateUserProps {
  id: string;
  tenantId: string;
  email: string;
  passwordHash: string;
  role: UserRole;
  now?: Date;
}

export class User {
  private constructor(private props: UserProps) {}

  static create(input: CreateUserProps): User {
    return new User({
      id: input.id,
      tenantId: input.tenantId,
      email: input.email,
      passwordHash: input.passwordHash,
      role: input.role,
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

  get passwordHash(): string {
    return this.props.passwordHash;
  }

  get role(): UserRole {
    return this.props.role;
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
}
