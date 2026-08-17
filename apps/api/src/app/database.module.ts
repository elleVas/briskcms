import { Global, Module } from '@nestjs/common';
import { type BriskDb, createAppDb } from '@brisk/postgres-db';

export const DATABASE = Symbol('DATABASE');

/**
 * One shared connection pool for the whole app — PagesModule and AuthModule
 * both need a BriskDb, and creating a separate postgres.js pool per module
 * would just duplicate the same provider for no benefit.
 */
@Global()
@Module({
  providers: [{ provide: DATABASE, useFactory: (): BriskDb => createAppDb() }],
  exports: [DATABASE],
})
export class DatabaseModule {}
