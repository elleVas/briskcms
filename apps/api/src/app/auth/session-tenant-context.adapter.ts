import { Inject, Injectable, Scope } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import type { TenantContextPort } from '@brisk/ports';
import type { AuthenticatedRequest } from './session-auth.guard';

/**
 * Replaces StaticTenantContextAdapter (see docs/adr/0006 and 0010): derives
 * the tenant from the session SessionAuthGuard already validated for this
 * request, instead of a fixed env var applied to every request regardless
 * of who's asking. Request-scoped because the tenant genuinely varies
 * per-request — see NestJS's request-scoped providers docs.
 */
@Injectable({ scope: Scope.REQUEST })
export class SessionTenantContextAdapter implements TenantContextPort {
  constructor(
    @Inject(REQUEST) private readonly request: AuthenticatedRequest,
  ) {}

  getCurrentTenantId(): string {
    return this.request.tenantId;
  }
}
