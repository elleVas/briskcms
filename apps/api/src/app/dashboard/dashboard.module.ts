import { Module } from '@nestjs/common';
import { type BriskDb } from '@brisk/postgres-db';
import { DrizzleDashboardStatsRepository } from '@brisk/postgres-dashboard-stats-repository';
import { AuthModule } from '../auth/auth.module';
import { DATABASE, DatabaseModule } from '../database.module';
import { DashboardController } from './dashboard.controller';
import { DASHBOARD_STATS_PORT } from './dashboard.tokens';

@Module({
  imports: [DatabaseModule, AuthModule],
  controllers: [DashboardController],
  providers: [
    {
      provide: DASHBOARD_STATS_PORT,
      useFactory: (db: BriskDb) => new DrizzleDashboardStatsRepository(db),
      inject: [DATABASE],
    },
  ],
})
export class DashboardModule {}
