import {
  type CanActivate,
  type ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import type { AuthPort } from '@brisk/ports';
import { AUTH_PORT } from './auth.tokens';
import { SESSION_COOKIE_NAME } from './session-cookie.constants';

export interface AuthenticatedRequest extends Request {
  tenantId: string;
  userId: string;
}

@Injectable()
export class SessionAuthGuard implements CanActivate {
  constructor(@Inject(AUTH_PORT) private readonly authPort: AuthPort) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token: unknown = request.cookies?.[SESSION_COOKIE_NAME];
    if (typeof token !== 'string') {
      throw new UnauthorizedException('No session');
    }

    const session = await this.authPort.validateSession(token);
    if (!session) {
      throw new UnauthorizedException('Invalid or expired session');
    }

    request.tenantId = session.tenantId;
    request.userId = session.userId;
    return true;
  }
}
