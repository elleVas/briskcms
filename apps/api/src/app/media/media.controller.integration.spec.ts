import { randomUUID } from 'node:crypto';
import { unlink } from 'node:fs/promises';
import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import express from 'express';
import request from 'supertest';
import sharp from 'sharp';
import type { AuthPort } from '@brisk/ports';
import {
  type BriskDb,
  deleteIntegrationFixtures,
  sites,
  users,
  withTenant,
} from '@brisk/postgres-db';
import { AUTH_PORT } from '../auth/auth.tokens.js';
import { DATABASE } from '../database.module.js';
import { MediaModule } from './media.module.js';

/**
 * Runs against a real Postgres and writes real files under MEDIA_UPLOAD_DIR
 * — see docs/development.md. Same throwaway-site-under-DEFAULT_TENANT_ID
 * isolation as pages.controller.integration.spec.ts, and cleans up every
 * file it writes in afterAll (this suite's own responsibility, since
 * MEDIA_UPLOAD_DIR isn't test-scoped the way an in-memory fixture would be).
 */
describe('MediaController (integration)', () => {
  let app: INestApplication;
  let db: BriskDb;
  let agent: ReturnType<typeof request.agent>;
  let siteId: string;
  let tenantId: string;
  let userId: string;
  const uploadedStorageKeys: string[] = [];

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [MediaModule],
    }).compile();

    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    // Mirrors main.ts's static-serving setup (minus the global prefix,
    // which this isolated test harness — like the sibling integration
    // specs — never sets either) so this suite exercises the real
    // upload-then-served-back path, not just the controller in isolation.
    app.use('/uploads', express.static(process.env.MEDIA_UPLOAD_DIR as string));
    await app.init();
    db = app.get<BriskDb>(DATABASE);

    tenantId = process.env.DEFAULT_TENANT_ID as string;

    const [site] = await withTenant(db, tenantId, (tx) =>
      tx
        .insert(sites)
        .values({
          tenantId,
          name: `Integration Site ${randomUUID()}`,
          defaultLocale: 'it',
        })
        .returning({ id: sites.id }),
    );
    siteId = site.id;

    const authPort = app.get<AuthPort>(AUTH_PORT);
    const email = `media-integration-${randomUUID()}@example.test`;
    const password = randomUUID();
    const passwordHash = await authPort.hashPassword(password);
    const [user] = await withTenant(db, tenantId, (tx) =>
      tx
        .insert(users)
        .values({ tenantId, email, passwordHash, role: 'admin' })
        .returning({ id: users.id }),
    );
    userId = user.id;

    agent = request.agent(app.getHttpServer());
    await agent
      .post('/auth/login')
      .send({ email, password, captchaToken: 'test-token' })
      .expect(200);
  });

  afterAll(async () => {
    const uploadDir = process.env.MEDIA_UPLOAD_DIR as string;
    for (const key of uploadedStorageKeys) {
      await unlink(`${uploadDir}/${key}`).catch(() => undefined);
    }
    await deleteIntegrationFixtures(db, tenantId, {
      siteIds: [siteId],
      userIds: [userId],
    });
    await app.close();
    await db.$client.end();
  });

  function pngBuffer(width: number, height: number): Promise<Buffer> {
    return sharp({
      create: {
        width,
        height,
        channels: 3,
        background: { r: 10, g: 20, b: 30 },
      },
    })
      .png()
      .toBuffer();
  }

  it('uploads an image, converts it, and serves it back over HTTP', async () => {
    const data = await pngBuffer(400, 300);

    const uploadRes = await agent
      .post('/media')
      .field('siteId', siteId)
      .attach('file', data, 'foto.png')
      .expect(201);

    expect(uploadRes.body.storageKey).toMatch(/\.webp$/);
    expect(uploadRes.body.mimeType).toBe('image/webp');
    expect(uploadRes.body.width).toBe(400);
    expect(uploadRes.body.url).toContain('/uploads/');
    uploadedStorageKeys.push(uploadRes.body.storageKey);

    const servedRes = await request(app.getHttpServer())
      .get(`/uploads/${uploadRes.body.storageKey}`)
      .expect(200);
    expect(servedRes.headers['content-type']).toContain('image/webp');
  });

  it('400s uploading a non-image file', async () => {
    await agent
      .post('/media')
      .field('siteId', siteId)
      .attach('file', Buffer.from('not an image'), 'documento.pdf')
      .expect(400);
  });

  it('400s with no file attached', async () => {
    await agent.post('/media').field('siteId', siteId).expect(400);
  });

  it('lists uploaded media for a site, newest first', async () => {
    const data = await pngBuffer(200, 200);
    const res = await agent
      .post('/media')
      .field('siteId', siteId)
      .attach('file', data, 'seconda-foto.png')
      .expect(201);
    uploadedStorageKeys.push(res.body.storageKey);

    const listRes = await agent.get('/media').query({ siteId }).expect(200);

    expect(listRes.body.total).toBeGreaterThanOrEqual(2);
    expect(listRes.body.items[0].storageKey).toBe(res.body.storageKey);
  });

  it('deletes media and it stops being served', async () => {
    const data = await pngBuffer(150, 150);
    const uploadRes = await agent
      .post('/media')
      .field('siteId', siteId)
      .attach('file', data, 'da-cancellare.png')
      .expect(201);

    await agent.delete(`/media/${uploadRes.body.id}`).expect(204);

    await request(app.getHttpServer())
      .get(`/uploads/${uploadRes.body.storageKey}`)
      .expect(404);
  });

  it('404s deleting media that does not exist', async () => {
    await agent.delete(`/media/${randomUUID()}`).expect(404);
  });

  it('401s without a session cookie', async () => {
    await request(app.getHttpServer())
      .get('/media')
      .query({ siteId })
      .expect(401);
  });
});
