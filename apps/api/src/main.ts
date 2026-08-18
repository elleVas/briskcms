/**
 * This is not a production server yet!
 * This is only a minimal backend to get started.
 */

import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import cookieParser from 'cookie-parser';
import express from 'express';
import { requireEnv } from '@brisk/env-config';
import { AppModule } from './app/app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const globalPrefix = 'api';
  app.setGlobalPrefix(globalPrefix);
  app.use(cookieParser());
  // Credentialed cookies can't use a wildcard origin — must be the exact
  // editor-app origin, see docs/adr/0010-session-based-auth-foundations.md.
  app.enableCors({ origin: requireEnv('EDITOR_APP_URL'), credentials: true });
  // apps/api serves uploaded media itself — no separate reverse-proxy route
  // to configure for self-hosting, see ADR-0013. Under the global prefix
  // since LocalDiskMediaStorageAdapter.getUrl() builds URLs against
  // API_PUBLIC_URL, which already includes it.
  app.use(
    `/${globalPrefix}/uploads`,
    express.static(requireEnv('MEDIA_UPLOAD_DIR')),
  );
  const port = process.env.PORT || 3000;
  await app.listen(port);
  Logger.log(
    `🚀 Application is running on: http://localhost:${port}/${globalPrefix}`,
  );
}

bootstrap();
