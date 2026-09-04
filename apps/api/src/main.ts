import { join } from 'node:path';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import express from 'express';
import helmet from 'helmet';
import { requireEnv } from '@brisk/env-config';
import { AppModule } from './app/app.module';
import { HttpExceptionFilter } from './app/http-exception.filter';
import { requestIdMiddleware } from './app/request-id.middleware';
import { validateApiEnv } from './env-schema';

// Security review 2026-08-24, "third pass": no global handler — an
// unhandled rejection or a throw outside every try/catch vanished, never
// logged. Node considers the process's state undefined after either of
// those two events (the same reason Node 15+ terminates by default on an
// unhandled unhandledRejection) — so log and exit, rather than carry on
// serving requests in a potentially corrupted state.
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
  // Fail fast on every missing/invalid env var at once, before any module
  // wiring starts — see env-schema.ts. Otherwise a deployment missing
  // several variables discovers them one restart at a time, in whatever
  // order NestJS happens to instantiate the module that first calls
  // requireEnv() for each of them.
  validateApiEnv();
  const app = await NestFactory.create(AppModule);
  // `docker stop`/`docker-compose down` send SIGTERM — without
  // enableShutdownHooks(), Nest never runs OnModuleDestroy (the Postgres
  // pool gets yanked instead of closed cleanly). enableShutdownHooks()
  // alone runs those hooks but does not itself end the process afterward
  // — verified directly against a real container: without an explicit
  // exit, something (the pg pool's own open socket) keeps the event loop
  // alive, so `docker stop` has to wait out its full grace period and
  // SIGKILL. Same log-and-exit posture as the unhandledRejection/
  // uncaughtException handlers above.
  app.enableShutdownHooks();
  for (const signal of ['SIGTERM', 'SIGINT'] as const) {
    process.on(signal, () => {
      Logger.log(`${signal} received, shutting down`);
      void app.close().finally(() => process.exit(0));
    });
  }
  const globalPrefix = 'api';
  app.setGlobalPrefix(globalPrefix);
  // crossOriginResourcePolicy off: media/attachments are meant to be
  // embedded cross-origin by apps/public-site and apps/editor-app.
  app.use(helmet({ crossOriginResourcePolicy: false }));
  app.use(compression());
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
