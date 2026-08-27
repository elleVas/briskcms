import {
  Body,
  Controller,
  Get,
  HttpCode,
  Inject,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  inviteUser,
  listUsers,
  resendInvite,
  setUserActive,
  updateUserRole,
} from '@brisk/application';
import type { User } from '@brisk/domain-core';
import type {
  AuthPort,
  EmailPort,
  TenantContextPort,
  UserRepositoryPort,
  VerificationTokenPort,
} from '@brisk/ports';
import {
  AUTH_PORT,
  EDITOR_APP_URL,
  EMAIL_PORT,
  TENANT_CONTEXT,
  USER_REPOSITORY,
  VERIFICATION_TOKEN_PORT,
} from '../auth/auth.tokens.js';
import { Roles } from '../auth/roles.decorator.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { SessionAuthGuard } from '../auth/session-auth.guard.js';
import { ZodValidationPipe } from '../zod-validation.pipe.js';
import {
  type InviteUserBody,
  inviteUserBodySchema,
  type ListUsersQuery,
  listUsersQuerySchema,
  type SetUserActiveBody,
  setUserActiveBodySchema,
  type UpdateUserRoleBody,
  updateUserRoleBodySchema,
} from './users.schemas.js';

// Every endpoint here is admin-only (Fase 5c: "Admin: tutto, incluse
// gestione utenti") — gated at the controller level, not per-method,
// since there's no lower-privilege action to carve out here the way
// PagesController does for publish vs draft.
@Controller('users')
@UseGuards(SessionAuthGuard, RolesGuard)
@Roles('admin')
export class UsersController {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: UserRepositoryPort,
    @Inject(AUTH_PORT) private readonly authPort: AuthPort,
    @Inject(VERIFICATION_TOKEN_PORT)
    private readonly verificationTokenPort: VerificationTokenPort,
    @Inject(EMAIL_PORT) private readonly emailPort: EmailPort,
    @Inject(EDITOR_APP_URL) private readonly editorAppUrl: string,
    @Inject(TENANT_CONTEXT)
    private readonly tenantContext: TenantContextPort,
  ) {}

  @Get()
  async list(
    @Query(new ZodValidationPipe(listUsersQuerySchema)) query: ListUsersQuery,
  ) {
    const result = await listUsers(
      { userRepository: this.userRepository },
      {
        tenantId: this.tenantContext.getCurrentTenantId(),
        page: query.page,
        pageSize: query.pageSize,
      },
    );
    return {
      items: result.items.map((user) => this.toDto(user)),
      total: result.total,
    };
  }

  @Post('invite')
  async invite(
    @Body(new ZodValidationPipe(inviteUserBodySchema)) body: InviteUserBody,
  ) {
    const user = await inviteUser(
      {
        userRepository: this.userRepository,
        authPort: this.authPort,
        verificationTokenPort: this.verificationTokenPort,
        emailPort: this.emailPort,
      },
      {
        tenantId: this.tenantContext.getCurrentTenantId(),
        email: body.email,
        displayName: body.displayName,
        role: body.role,
        inviteUrlBase: this.editorAppUrl,
      },
    );
    return this.toDto(user);
  }

  /**
   * Security review 2026-08-24, "terzo giro": un invito scaduto (7 giorni,
   * vedi inviteUser) lasciava l'email dell'invitato bloccata per sempre
   * (UserEmailAlreadyExistsError su un nuovo invite), senza alcun modo di
   * dargli un link nuovo. Rifiuta con UserAlreadyActiveError (mappato a
   * 409 sotto) se l'invito è già stato accettato — non ha senso re-inviarlo.
   */
  @Post(':id/resend-invite')
  @HttpCode(200)
  async resend(@Param('id') id: string) {
    await resendInvite(
      {
        userRepository: this.userRepository,
        verificationTokenPort: this.verificationTokenPort,
        emailPort: this.emailPort,
      },
      {
        tenantId: this.tenantContext.getCurrentTenantId(),
        userId: id,
        inviteUrlBase: this.editorAppUrl,
      },
    );
    return { success: true };
  }

  @Patch(':id/role')
  async updateRole(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateUserRoleBodySchema))
    body: UpdateUserRoleBody,
  ) {
    const user = await updateUserRole(
      { userRepository: this.userRepository },
      {
        tenantId: this.tenantContext.getCurrentTenantId(),
        userId: id,
        role: body.role,
      },
    );
    return this.toDto(user);
  }

  @Patch(':id/active')
  async setActive(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(setUserActiveBodySchema))
    body: SetUserActiveBody,
  ) {
    const user = await setUserActive(
      { userRepository: this.userRepository, authPort: this.authPort },
      {
        tenantId: this.tenantContext.getCurrentTenantId(),
        userId: id,
        isActive: body.isActive,
      },
    );
    return this.toDto(user);
  }

  /** Built field-by-field, never a `...rest` of toProps() — unlike Page (no secret fields), a user row has passwordHash, which must never reach the client. */
  private toDto(user: User) {
    const props = user.toProps();
    return {
      id: props.id,
      tenantId: props.tenantId,
      email: props.email,
      displayName: props.displayName,
      role: props.role,
      isActive: props.isActive,
      emailVerifiedAt: props.emailVerifiedAt,
      createdAt: props.createdAt,
    };
  }
}
