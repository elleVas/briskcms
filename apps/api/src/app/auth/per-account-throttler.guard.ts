import {
  Inject,
  Injectable,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import { ThrottlerException, ThrottlerStorage } from '@nestjs/throttler';

const TTL_MS = 15 * 60 * 1000;
const LIMIT = 5;

/**
 * A second axis of rate limiting, independent of `ThrottlerGuard` (per-IP,
 * already applied to login and request-password-reset) — security review
 * 2026-08-24, point 13: with the per-IP limit alone, an attacker from a
 * single IP can stay under the threshold (5/min) and still send up to 300
 * reset emails an hour to the same victim; from several IPs, unlimited.
 * This closes that hole by tracking per EMAIL rather than per IP, no matter
 * how many addresses send them.
 *
 * It reuses `ThrottlerStorage` (the same in-memory storage
 * `ThrottlerModule` already injects in AuthModule) rather than registering
 * a second "named" throttler — `ThrottlerGuard` applies the same tracker
 * (the IP by default) to EVERY named throttler it sees, so a second named
 * config would still not key on the email without also duplicating the
 * existing per-IP tracker logic.
 */
@Injectable()
export class PerAccountThrottlerGuard implements CanActivate {
  constructor(
    @Inject(ThrottlerStorage) private readonly storage: ThrottlerStorage,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<{
      body?: { email?: unknown };
    }>();
    const email =
      typeof req.body?.email === 'string'
        ? req.body.email.trim().toLowerCase()
        : null;
    // No valid email to track — it is not this guard's job to reject the
    // request (ZodValidationPipe will do that downstream anyway), it simply
    // counts nothing.
    if (!email) {
      return true;
    }

    const key = `per-account:${context.getClass().name}:${context.getHandler().name}:${email}`;
    const record = await this.storage.increment(
      key,
      TTL_MS,
      LIMIT,
      0,
      'per-account',
    );
    if (record.totalHits > LIMIT) {
      throw new ThrottlerException();
    }
    return true;
  }
}
