/**
 * This is not a production server yet!
 * This is only a minimal backend to get started.
 */

import { join } from 'node:path';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import cookieParser from 'cookie-parser';
import express from 'express';
import helmet from 'helmet';
import { requireEnv } from '@brisk/env-config';
import { AppModule } from './app/app.module';
import { HttpExceptionFilter } from './app/http-exception.filter';
import { requestIdMiddleware } from './app/request-id.middleware';

// Security review 2026-08-24, "terzo giro": nessun handler globale — un
// reject non gestito o un throw fuori da qualunque try/catch spariva nel
// nulla, mai loggato. Node considera lo stato del processo indefinito dopo
// uno di questi due eventi (stesso motivo per cui Node 15+ termina di
// default su un unhandledRejection non gestito) — loggare e uscire, non
// continuare a servire richieste in uno stato potenzialmente corrotto.
process.on('unhandledRejection', (reason) => {
  Logger.error(
    'Unhandled promise rejection',
    reason instanceof Error ? reason.stack : String(reason),
  );
  process.exit(1);
});
process.on('uncaughtException', (error) => {
  Logger.error('Uncaught exception', error.stack);
  process.exit(1);
});

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const globalPrefix = 'api';
  app.setGlobalPrefix(globalPrefix);
  // crossOriginResourcePolicy off: media/attachments are meant to be
  // embedded cross-origin by apps/public-site and apps/editor-app.
  app.use(helmet({ crossOriginResourcePolicy: false }));
  app.use(cookieParser());
  app.use(requestIdMiddleware);
  app.useGlobalFilters(new HttpExceptionFilter());
  // Credentialed cookies can't use a wildcard origin — must be the exact
  // editor-app origin, see docs/adr/0010-session-based-auth-foundations.md.
  app.enableCors({ origin: requireEnv('EDITOR_APP_URL'), credentials: true });
  const mediaUploadDir = requireEnv('MEDIA_UPLOAD_DIR');
  // Public form attachments (public-forms.controller.ts, unauthenticated
  // upload) are content-sniffed on the way in (sniffAttachmentType) but
  // served here with a second, independent layer of defense: forced
  // download instead of inline rendering, so even a type that slipped
  // through can never execute as HTML/SVG in a browser (security review
  // 2026-08-25). Mounted before the general /uploads static below so it
  // wins for this subpath.
  app.use(
    `/${globalPrefix}/uploads/attachments`,
    express.static(join(mediaUploadDir, 'attachments'), {
      setHeaders: (res) => {
        res.setHeader('Content-Disposition', 'attachment');
        res.setHeader('X-Content-Type-Options', 'nosniff');
      },
    }),
  );
  // apps/api serves uploaded media itself — no separate reverse-proxy route
  // to configure for self-hosting, see ADR-0013. Under the global prefix
  // since LocalDiskMediaStorageAdapter.getUrl() builds URLs against
  // API_PUBLIC_URL, which already includes it.
  app.use(`/${globalPrefix}/uploads`, express.static(mediaUploadDir));
  const port = process.env.PORT || 3000;
  await app.listen(port);
  Logger.log(
    `🚀 Application is running on: http://localhost:${port}/${globalPrefix}`,
  );
}

bootstrap();
