import { Controller, Get, Inject, Query, UseGuards } from '@nestjs/common';
import { getDashboardStats } from '@brisk/application';
import type { DashboardStatsPort, TenantContextPort } from '@brisk/ports';
import { SessionAuthGuard } from '../auth/session-auth.guard';
import { ZodValidationPipe } from '../zod-validation.pipe';
import { TENANT_CONTEXT } from '../auth/auth.tokens';
import { DASHBOARD_STATS_PORT } from './dashboard.tokens';
import {
  type GetDashboardStatsQuery,
  getDashboardStatsQuerySchema,
} from './dashboard.schemas';

@Controller('dashboard')
@UseGuards(SessionAuthGuard)
export class DashboardController {
  constructor(
    @Inject(DASHBOARD_STATS_PORT)
    private readonly dashboardStatsPort: DashboardStatsPort,
    @Inject(TENANT_CONTEXT) private readonly tenantContext: TenantContextPort,
  ) {}

  @Get('stats')
  async getStats(
    @Query(new ZodValidationPipe(getDashboardStatsQuerySchema))
    query: GetDashboardStatsQuery,
  ) {
    return getDashboardStats(
      { dashboardStatsPort: this.dashboardStatsPort },
      {
        tenantId: this.tenantContext.getCurrentTenantId(),
        siteId: query.siteId,
      },
    );
  }
}
