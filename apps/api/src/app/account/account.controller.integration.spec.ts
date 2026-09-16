import { randomUUID } from 'node:crypto';
import { stat, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import sharp from 'sharp';
import type { AuthPort } from '@brisk/ports';
import { type BriskDb, users, withTenant } from '@brisk/postgres-db';
import { deleteIntegrationFixtures } from '@brisk/postgres-db/testing';
import { AUTH_PORT } from '../auth/auth.tokens';
import { DATABASE } from '../database.module';
import { HttpExceptionFilter } from '../http-exception.filter';
import { requestIdMiddleware } from '../request-id.middleware';
import { AccountModule } from './account.module';

/**
 * Runs against a real Postgres and writes real files under MEDIA_UPLOAD_DIR
 * — see docs/development.md. Two people under DEFAULT_TENANT_ID, removed
 * in afterAll with every picture this suite stored.
 */
describe('AccountController (integration)', () => {
  let app: INestApplication;
  let db: BriskDb;
  let agent: ReturnType<typeof request.agent>;
  let tenantId: string;
  let email: string;
  const userIds: string[] = [];
  const storedKeys: string[] = [];
  // Unique per run: author addresses are unique across the whole tenant.
  const run = randomUUID().slice(0, 8);

  async function createUser(
    role: 'admin' | 'editor',
    password: string,
    authorAddress: { slug?: string; formerSlugs?: string[] } = {},
  ) {
    const authPort = app.get<AuthPort>(AUTH_PORT);
    const address = `account-integration-${randomUUID()}@example.test`;
    const passwordHash = await authPort.hashPassword(password);
    const [user] = await withTenant(db, tenantId, (tx) =>
      tx
        .insert(users)
        .values({
          tenantId,
          email: address,
          passwordHash,
          role,
          ...authorAddress,
        })
        .returning({ id: users.id }),
    );
    userIds.push(user.id);
    return { id: user.id, email: address };
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AccountModule],
    }).compile();

    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    app.useGlobalFilters(new HttpExceptionFilter());
    app.use(requestIdMiddleware);
    await app.init();
    db = app.get<BriskDb>(DATABASE);
    tenantId = process.env.DEFAULT_TENANT_ID as string;

    // An editor, not an admin: every role has a profile of its own.
    const password = randomUUID();
    const editor = await createUser('editor', password);
    email = editor.email;
    agent = request.agent(app.getHttpServer());
    await agent
      .post('/auth/login')
      .send({ email, password, captchaToken: 'test-token' })
      .expect(200);
  });

  afterAll(async () => {
    const uploadDir = process.env.MEDIA_UPLOAD_DIR as string;
    for (const key of storedKeys) {
      await unlink(join(uploadDir, key)).catch(() => undefined);
    }
    await deleteIntegrationFixtures(db, tenantId, { userIds });
    await app.close();
    await db.$client.end();
  });

  const storageKeyOf = (url: string) => url.split('/uploads/')[1] ?? '';

  it('refuses anyone without a session', async () => {
    await request(app.getHttpServer()).get('/account/profile').expect(401);
    await request(app.getHttpServer())
      .patch('/account/profile')
      .send({ displayName: 'X', slug: null, bio: {} })
      .expect(401);
  });

  it('shows the signed-in person their own profile, and nothing secret', async () => {
    const res = await agent.get('/account/profile').expect(200);

    expect(res.body).toEqual({
      id: userIds[0],
      email,
      role: 'editor',
      displayName: null,
      slug: null,
      bio: {},
      avatarUrl: null,
    });
    expect(JSON.stringify(res.body)).not.toContain('passwordHash');
  });

  it('gives them an address from their name the first time they have one', async () => {
    const res = await agent
      .patch('/account/profile')
      .send({
        displayName: `Giulia Àccount ${run}`,
        slug: null,
        bio: { it: 'Scrive di caffè.', en: 'Writes about coffee.' },
      })
      .expect(200);

    expect(res.body.displayName).toBe(`Giulia Àccount ${run}`);
    expect(res.body.slug).toBe(`giulia-account-${run}`);
    expect(res.body.bio).toEqual({
      it: 'Scrive di caffè.',
      en: 'Writes about coffee.',
    });
  });

  it('refuses an address someone else has — now or before — with a 409', async () => {
    await createUser('admin', randomUUID(), {
      slug: `preso-${run}`,
      formerSlugs: [`lasciato-${run}`],
    });

    await agent
      .patch('/account/profile')
      .send({ displayName: 'Giulia', slug: `preso-${run}`, bio: {} })
      .expect(409);
    await agent
      .patch('/account/profile')
      .send({ displayName: 'Giulia', slug: `lasciato-${run}`, bio: {} })
      .expect(409);
  });

  it('refuses an address that is not a slug, and a bio that is not keyed by language', async () => {
    await agent
      .patch('/account/profile')
      .send({ displayName: 'Giulia', slug: 'Not A Slug', bio: {} })
      .expect(400);
    await agent
      .patch('/account/profile')
      .send({ displayName: 'Giulia', slug: null, bio: { '<b>': 'x' } })
      .expect(400);
    await agent
      .patch('/account/profile')
      .send({
        displayName: 'Giulia',
        slug: null,
        bio: { it: 'x'.repeat(1001) },
      })
      .expect(400);
  });

  it('stores a picture, replaces it, and removes it — files included', async () => {
    const png = await sharp({
      create: { width: 300, height: 300, channels: 3, background: '#335577' },
    })
      .png()
      .toBuffer();
    const uploadDir = process.env.MEDIA_UPLOAD_DIR as string;

    const first = await agent
      .post('/account/avatar')
      .attach('file', png, 'me.png')
      .expect(200);
    const firstKey = storageKeyOf(first.body.avatarUrl);
    storedKeys.push(firstKey);
    expect(firstKey).toMatch(/\.webp$/);
    await expect(stat(join(uploadDir, firstKey))).resolves.toBeDefined();

    const second = await agent
      .post('/account/avatar')
      .attach('file', png, 'me.png')
      .expect(200);
    const secondKey = storageKeyOf(second.body.avatarUrl);
    storedKeys.push(secondKey);
    // The picture it replaced is gone from disk, not orphaned.
    await expect(stat(join(uploadDir, firstKey))).rejects.toThrow();

    const removed = await agent.delete('/account/avatar').expect(200);
    expect(removed.body.avatarUrl).toBeNull();
    await expect(stat(join(uploadDir, secondKey))).rejects.toThrow();
  });

  it('refuses a file that is not a picture, whatever it is called', async () => {
    await agent
      .post('/account/avatar')
      .attach('file', Buffer.from('<svg onload="alert(1)"></svg>'), 'me.png')
      .expect(400);
    await agent.post('/account/avatar').expect(400);
  });
});
