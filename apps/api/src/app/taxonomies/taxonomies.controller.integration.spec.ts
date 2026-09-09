import { randomUUID } from 'node:crypto';
import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import type { AuthPort } from '@brisk/ports';
import {
  deleteIntegrationFixtures,
  sites,
  users,
  withTenant,
  type BriskDb,
} from '@brisk/postgres-db';
import { HttpExceptionFilter } from '../http-exception.filter';
import { requestIdMiddleware } from '../request-id.middleware';
import { AUTH_PORT } from '../auth/auth.tokens';
import { DATABASE } from '../database.module';
import { PagesModule } from '../pages/pages.module';
import { TaxonomiesModule } from './taxonomies.module';

/**
 * Runs against a real Postgres, through the real HTTP stack — the same
 * discipline as the page-groups spec next door. Both modules are loaded
 * because the rule under test spans them: a term cannot land on a page's
 * address and a page cannot land on a term's, and the two halves are
 * enforced in different controllers (docs/adr/0064).
 */
describe('TaxonomiesController (integration)', () => {
  let app: INestApplication;
  let db: BriskDb;
  let agent: ReturnType<typeof request.agent>;
  let siteId: string;
  let tenantId: string;
  const createdUserIds: string[] = [];

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [TaxonomiesModule, PagesModule],
    }).compile();

    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    app.useGlobalFilters(new HttpExceptionFilter());
    app.use(requestIdMiddleware);
    await app.init();
    db = app.get<BriskDb>(DATABASE);
    tenantId = process.env.DEFAULT_TENANT_ID as string;

    const [site] = await withTenant(db, tenantId, (tx) =>
      tx
        .insert(sites)
        .values({
          tenantId,
          name: `Taxonomy Site ${randomUUID()}`,
          defaultLocale: 'en',
          enabledLocales: ['en', 'it'],
        })
        .returning({ id: sites.id }),
    );
    siteId = site.id;

    const authPort = app.get<AuthPort>(AUTH_PORT);
    const email = `taxonomy-${randomUUID()}@example.test`;
    const password = randomUUID();
    const passwordHash = await authPort.hashPassword(password);
    const [user] = await withTenant(db, tenantId, (tx) =>
      tx
        .insert(users)
        .values({ tenantId, email, passwordHash, role: 'admin' })
        .returning({ id: users.id }),
    );
    createdUserIds.push(user.id);

    agent = request.agent(app.getHttpServer());
    await agent
      .post('/auth/login')
      .send({ email, password, captchaToken: 'test-token' })
      .expect(200);
  });

  afterAll(async () => {
    await deleteIntegrationFixtures(db, tenantId, {
      siteIds: [siteId],
      userIds: createdUserIds,
    });
    await app.close();
    await db.$client.end();
  });

  /** Not `async`: the caller chains `.expect()` on it, which is supertest's own, not a promise's. */
  function createTaxonomy(body: Record<string, unknown>) {
    return agent.post('/taxonomies').send({ siteId, ...body });
  }

  it('runs the whole cycle over HTTP: dimension, term, re-file, page assignment', async () => {
    const suffix = randomUUID().slice(0, 8);
    const created = await createTaxonomy({
      name: { en: `Category ${suffix}`, it: `Categoria ${suffix}` },
      prefix: `category-${suffix}`,
    }).expect(201);
    const taxonomyId = created.body.id;
    expect(created.body.prefix).toBe(`category-${suffix}`);
    expect(created.body.hierarchical).toBe(true);

    const parent = await agent
      .post(`/taxonomies/${taxonomyId}/terms`)
      .send({ name: { en: `Machines ${suffix}` } })
      .expect(201);
    expect(parent.body.slugs).toEqual({ en: `machines-${suffix}` });

    const child = await agent
      .post(`/taxonomies/${taxonomyId}/terms`)
      .send({
        name: { en: `Automatic ${suffix}` },
        parentId: parent.body.id,
      })
      .expect(201);
    expect(child.body.parentId).toBe(parent.body.id);

    const listed = await agent
      .get(`/taxonomies/${taxonomyId}/terms`)
      .expect(200);
    expect(listed.body).toHaveLength(2);

    // Re-filing keeps the address: it never contained the ancestors.
    const moved = await agent
      .patch(`/taxonomies/terms/${child.body.id}/parent`)
      .send({ parentId: null })
      .expect(200);
    expect(moved.body.parentId).toBeNull();
    expect(moved.body.slugs).toEqual({ en: `automatic-${suffix}` });

    const group = await agent.post('/page-groups').send({ siteId }).expect(201);
    const assigned = await agent
      .patch(`/page-groups/${group.body.id}/terms`)
      .send({ termIds: [parent.body.id, child.body.id] })
      .expect(200);
    expect(assigned.body.termIds).toHaveLength(2);

    const readBack = await agent
      .get(`/page-groups/${group.body.id}/terms`)
      .expect(200);
    expect(readBack.body.termIds).toHaveLength(2);
  });

  it('answers 409 when a dimension asks for a prefix that is taken', async () => {
    const prefix = `family-${randomUUID().slice(0, 8)}`;
    await createTaxonomy({ name: { en: 'Family' }, prefix }).expect(201);

    await createTaxonomy({ name: { en: 'Family again' }, prefix }).expect(409);
  });

  /*
   * The two halves of the rule no database constraint can hold, over
   * HTTP: a root-mounted term and a root page competing for one address,
   * from both directions.
   */
  it('answers 409 in both directions when a term and a page want one address', async () => {
    const suffix = randomUUID().slice(0, 8);
    const rootMounted = await createTaxonomy({
      name: { en: `Loose ${suffix}` },
      prefix: null,
    }).expect(201);

    await agent
      .post(`/taxonomies/${rootMounted.body.id}/terms`)
      .send({ name: { en: `Espresso ${suffix}` } })
      .expect(201);

    const group = await agent.post('/page-groups').send({ siteId }).expect(201);
    const pageOnTerm = await agent
      .post(`/page-groups/${group.body.id}/translations`)
      .send({
        locale: 'en',
        slug: `espresso-${suffix}`,
        seoMeta: { title: 'Espresso', description: '' },
      });
    expect(pageOnTerm.status).toBe(409);

    // ...and the other way round: a page first, then a term asking for
    // the address it already answers.
    const otherGroup = await agent
      .post('/page-groups')
      .send({ siteId })
      .expect(201);
    const pageSlug = `contact-${suffix}`;
    await agent
      .post(`/page-groups/${otherGroup.body.id}/translations`)
      .send({
        locale: 'en',
        slug: pageSlug,
        seoMeta: { title: 'Contact', description: '' },
      })
      .expect(201);

    const termOnPage = await agent
      .post(`/taxonomies/${rootMounted.body.id}/terms`)
      .send({ name: { en: 'Contact' }, slugs: { en: pageSlug } });
    expect(termOnPage.status).toBe(409);
  });

  it('answers 400 when a term is asked to descend from itself', async () => {
    const suffix = randomUUID().slice(0, 8);
    const taxonomy = await createTaxonomy({
      name: { en: `Cycle ${suffix}` },
      prefix: `cycle-${suffix}`,
    }).expect(201);
    const parent = await agent
      .post(`/taxonomies/${taxonomy.body.id}/terms`)
      .send({ name: { en: `Parent ${suffix}` } })
      .expect(201);
    const child = await agent
      .post(`/taxonomies/${taxonomy.body.id}/terms`)
      .send({ name: { en: `Child ${suffix}` }, parentId: parent.body.id })
      .expect(201);

    await agent
      .patch(`/taxonomies/terms/${parent.body.id}/parent`)
      .send({ parentId: child.body.id })
      .expect(400);
  });

  it('moves every term when the dimension prefix changes', async () => {
    const suffix = randomUUID().slice(0, 8);
    const taxonomy = await createTaxonomy({
      name: { en: `Movable ${suffix}` },
      prefix: `before-${suffix}`,
    }).expect(201);
    await agent
      .post(`/taxonomies/${taxonomy.body.id}/terms`)
      .send({ name: { en: `Thing ${suffix}` } })
      .expect(201);

    const updated = await agent
      .patch(`/taxonomies/${taxonomy.body.id}`)
      .send({ prefix: `after-${suffix}` })
      .expect(200);

    expect(updated.body.prefix).toBe(`after-${suffix}`);
    // The term is still there and still answers — under the new prefix.
    const terms = await agent
      .get(`/taxonomies/${taxonomy.body.id}/terms`)
      .expect(200);
    expect(terms.body[0].slugs).toEqual({ en: `thing-${suffix}` });
  });

  it('requires a session', async () => {
    await request(app.getHttpServer())
      .get(`/taxonomies?siteId=${siteId}`)
      .expect(401);
  });
});
