import { randomUUID } from 'node:crypto';
import { stat, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { type INestApplication } from '@nestjs/common';
import request from 'supertest';
import sharp from 'sharp';
import { AccountModule } from './account.module';
import {
  IntegrationApp,
  type IntegrationUser,
} from '../../test/integration-app.test-fixture';

/**
 * Runs against a real Postgres and writes real files under MEDIA_UPLOAD_DIR
 * — see docs/development.md. Two people under DEFAULT_TENANT_ID, removed
 * in afterAll with every picture this suite stored.
 */
describe('AccountController (integration)', () => {
  let integration: IntegrationApp;
  let app: INestApplication;
  let agent: ReturnType<typeof request.agent>;
  let editor: IntegrationUser;
  const storedKeys: string[] = [];
  // Unique per run: author addresses are unique across the whole tenant.
  const run = randomUUID().slice(0, 8);

  beforeAll(async () => {
    integration = await IntegrationApp.start({ imports: [AccountModule] });
    app = integration.app;

    // An editor, not an admin: every role has a profile of its own.
    editor = await integration.createUser({ role: 'editor' });
    agent = await integration.login(editor);
  });

  afterAll(async () => {
    const uploadDir = process.env.MEDIA_UPLOAD_DIR as string;
    for (const key of storedKeys) {
      await unlink(join(uploadDir, key)).catch(() => undefined);
    }
    await integration.close();
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
      id: editor.id,
      email: editor.email,
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
    await integration.createUser({
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
