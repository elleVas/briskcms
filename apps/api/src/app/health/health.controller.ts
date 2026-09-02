import {
  Controller,
  Get,
  Inject,
  ServiceUnavailableException,
} from '@nestjs/common';
import { pingDatabase, type BriskDb } from '@brisk/postgres-db';
import { DATABASE } from '../database.module';

/**
 * Unauthenticated on purpose — this is the Docker/Caddy healthcheck target
 * (docs/adr/0042), checked before a session exists and often by something
 * that isn't a browser at all. Round-trips Postgres rather than just
 * returning a static 200: a container that's up but can't reach its own
 * database should read as unhealthy, not healthy.
 */
@Controller('health')
export class HealthController {
  constructor(@Inject(DATABASE) private readonly db: BriskDb) {}

  @Get()
  async check(): Promise<{ status: 'ok' }> {
    try {
      await pingDatabase(this.db);
    } catch (error) {
      throw new ServiceUnavailableException(
        error instanceof Error ? error.message : 'Database unreachable',
      );
    }
    return { status: 'ok' };
  }
}
