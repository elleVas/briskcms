import express from 'express';
import { join } from 'node:path';
import type { INestApplication } from '@nestjs/common';

/**
 * How uploaded files are served, in one place (ADR-0054).
 *
 * It lives here rather than inline in `main.ts` because the integration
 * tests need the SAME configuration: they used to mount their own bare
 * `express.static`, which meant a test asserting a response header was
 * really asserting the test's own setup, and would have kept passing if
 * production had lost the header entirely.
 *
 * Two trees with different rules:
 *
 * - **attachments** — public form uploads, taken from unauthenticated
 *   visitors. Content-sniffed on the way in (`sniffAttachmentType`) and
 *   forced to download here as a second, independent layer: even a type
 *   that slipped through can never execute as HTML or SVG in a browser
 *   (security review 2026-08-25).
 * - **media** — the library. Served INLINE, deliberately: an `<img>`,
 *   `<video>` or `<audio>` cannot render a file the server told the
 *   browser to save. What makes that safe is upstream — images are
 *   re-encoded to WebP by sharp, and video and audio have their bytes
 *   checked against a short allow-list that contains nothing executable
 *   (ADR-0054).
 *
 * `nosniff` on both: it costs nothing and removes "the browser decided
 * the type differs from what we said" from consideration entirely.
 */
export function mountMediaStatic(
  app: INestApplication,
  mediaUploadDir: string,
  prefix = '',
): void {
  // Mounted before the general media route below so it wins for this
  // subpath.
  app.use(
    `${prefix}/uploads/attachments`,
    express.static(join(mediaUploadDir, 'attachments'), {
      setHeaders: (res) => {
        res.setHeader('Content-Disposition', 'attachment');
        res.setHeader('X-Content-Type-Options', 'nosniff');
      },
    }),
  );
  app.use(
    `${prefix}/uploads`,
    express.static(mediaUploadDir, {
      setHeaders: (res) => {
        res.setHeader('X-Content-Type-Options', 'nosniff');
      },
    }),
  );
}
