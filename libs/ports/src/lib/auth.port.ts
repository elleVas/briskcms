export interface Session {
  token: string;
  userId: string;
  expiresAt: Date;
}

/** Implementata dall'adapter Lucia/Better-Auth in Fase 3 — argon2id, sessioni via cookie. */
export interface AuthPort {
  hashPassword(plainText: string): Promise<string>;
  verifyPassword(plainText: string, passwordHash: string): Promise<boolean>;
  createSession(userId: string): Promise<Session>;
  validateSession(token: string): Promise<Session | null>;
  invalidateSession(token: string): Promise<void>;
}
