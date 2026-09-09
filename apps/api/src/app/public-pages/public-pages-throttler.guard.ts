import { createHash, timingSafeEqual } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import type { Request } from 'express';
import {
  PUBLIC_API_SERVICE_TOKEN_HEADER,
  PUBLIC_API_VISITOR_IP_HEADER,
} from '@brisk/shared-types';

/**
 * Rate-limits the person browsing, not the server rendering for them.
 *
 * Every public page view reaches this API through `apps/public-site`,
 * server side (`API_URL` is `http://api:3000/api`, container to
 * container — it does not go back out through Caddy). To the default
 * throttler, which keys on the connecting address, that is ONE client:
 * the whole site's traffic shared a single 120/min bucket, so a link
 * doing well or a search engine indexing meant a 500 for every visitor
 * at once — and it was never able to tell an abusive visitor from a
 * popular afternoon, which is the job it was written for.
 *
 * The public site now says whose page view this is. That claim is
 * believed only when the caller proves it is the public site: this API
 * answers on a public hostname (`api.{DOMAIN}` in the Caddyfile), so a
 * header anyone can set would be a rate limit anyone can escape by
 * inventing a fresh address per request.
 *
 * With `PUBLIC_API_SERVICE_TOKEN` unset, nothing is trusted and this
 * behaves exactly as the default guard does — an existing deployment
 * upgrades without touching its env and loses nothing it had.
 */
@Injectable()
export class PublicPagesThrottlerGuard extends ThrottlerGuard {
  protected override async getTracker(req: Request): Promise<string> {
    const visitorIp = headerValue(req, PUBLIC_API_VISITOR_IP_HEADER);
    if (visitorIp && this.isOwnPublicSite(req)) {
      return visitorIp;
    }
    return super.getTracker(req);
  }

  private isOwnPublicSite(req: Request): boolean {
    const expected = process.env['PUBLIC_API_SERVICE_TOKEN'];
    if (!expected) return false;
    const presented = headerValue(req, PUBLIC_API_SERVICE_TOKEN_HEADER);
    if (!presented) return false;
    // Hashed to a fixed width first: timingSafeEqual throws on a length
    // mismatch, and that throw is itself an oracle for the token's length.
    return timingSafeEqual(sha256(presented), sha256(expected));
  }
}

function sha256(value: string): Buffer {
  return createHash('sha256').update(value).digest();
}

/** A repeated header arrives as an array; a caller does not get to pick which one is read. */
function headerValue(req: Request, name: string): string | null {
  const raw = req.headers[name];
  return typeof raw === 'string' && raw.length > 0 ? raw : null;
}
