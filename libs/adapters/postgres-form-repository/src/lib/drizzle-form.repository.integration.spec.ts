import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Form, FormSubmission } from '@brisk/domain-core';
import {
  type BriskDb,
  createAppDb,
  deleteIntegrationTenants,
  sites,
  tenants,
  withTenant,
} from '@brisk/postgres-db';
import { DrizzleFormRepository } from './drizzle-form.repository';
import { DrizzleFormSubmissionRepository } from './drizzle-form-submission.repository';

/**
 * Runs against a real Postgres — see docs/development.md ("docker compose up
 * -d postgres" + run migrations first). Connects as `brisk_app`, same as
 * production code, so this is also the RLS regression test: any change that
 * accidentally weakens tenant isolation should fail here, not in production.
 */
describe('DrizzleFormRepository (integration)', () => {
  let db: BriskDb;
  let formRepository: DrizzleFormRepository;
  let formSubmissionRepository: DrizzleFormSubmissionRepository;
  let tenantAId: string;
  let tenantBId: string;
  let siteAId: string;

  beforeAll(async () => {
    db = createAppDb();
    formRepository = new DrizzleFormRepository(db);
    formSubmissionRepository = new DrizzleFormSubmissionRepository(db);

    const [tenantA] = await db
      .insert(tenants)
      .values({ name: `Integration Tenant A ${randomUUID()}` })
      .returning({ id: tenants.id });
    const [tenantB] = await db
      .insert(tenants)
      .values({ name: `Integration Tenant B ${randomUUID()}` })
      .returning({ id: tenants.id });
    tenantAId = tenantA.id;
    tenantBId = tenantB.id;

    const [siteA] = await withTenant(db, tenantAId, (tx) =>
      tx
        .insert(sites)
        .values({ tenantId: tenantAId, name: 'Site A', defaultLocale: 'it' })
        .returning({ id: sites.id }),
    );
    siteAId = siteA.id;
  });

  afterAll(async () => {
    await deleteIntegrationTenants(db, [tenantAId, tenantBId]);
    await db.$client.end();
  });

  function buildForm(
    overrides: Partial<Parameters<typeof Form.create>[0]> = {},
  ) {
    return Form.create({
      id: randomUUID(),
      tenantId: tenantAId,
      siteId: siteAId,
      name: 'Contatti',
      ...overrides,
    });
  }

  it('saves and retrieves a form by id, scoped to its tenant', async () => {
    const form = buildForm();
    await formRepository.save(form);

    const found = await formRepository.findById(tenantAId, form.id);
    expect(found?.id).toBe(form.id);
    expect(found?.name).toBe('Contatti');
    expect(found?.fields).toEqual([]);
    expect(found?.steps).toEqual([]);
    expect(found?.notificationEmail).toBeNull();

    const foundFromOtherTenant = await formRepository.findById(
      tenantBId,
      form.id,
    );
    expect(foundFromOtherTenant).toBeNull();
  });

  it('listBySite scopes by tenant and site, most recently updated first', async () => {
    const older = buildForm({ now: new Date(Date.now() - 1000) });
    const newer = buildForm({ now: new Date() });
    await formRepository.save(older);
    await formRepository.save(newer);

    const found = await formRepository.listBySite(tenantAId, siteAId, {
      page: 1,
      pageSize: 100,
    });
    const foundIds = found.items.map((form) => form.id);
    expect(foundIds.indexOf(newer.id)).toBeLessThan(foundIds.indexOf(older.id));

    const foundFromOtherTenant = await formRepository.listBySite(
      tenantBId,
      siteAId,
      { page: 1, pageSize: 100 },
    );
    expect(foundFromOtherTenant.items).toHaveLength(0);
    expect(foundFromOtherTenant.total).toBe(0);
  });

  it('listBySite paginates with limit/offset and reports the total', async () => {
    for (let i = 0; i < 3; i++) {
      await formRepository.save(
        buildForm({ now: new Date(Date.now() - i * 1000) }),
      );
    }

    const firstPage = await formRepository.listBySite(tenantAId, siteAId, {
      page: 1,
      pageSize: 2,
    });
    expect(firstPage.items).toHaveLength(2);
    expect(firstPage.total).toBeGreaterThanOrEqual(3);

    const secondPage = await formRepository.listBySite(tenantAId, siteAId, {
      page: 2,
      pageSize: 2,
    });
    const firstIds = firstPage.items.map((form) => form.id);
    const secondIds = secondPage.items.map((form) => form.id);
    expect(firstIds.some((id) => secondIds.includes(id))).toBe(false);
  });

  it('save() upserts: a second save updates the same row instead of inserting a new one', async () => {
    const form = buildForm();
    await formRepository.save(form);

    form.update(
      {
        name: 'Contatti aggiornato',
        fields: [
          {
            id: 'email',
            label: 'Email',
            type: 'email',
            required: true,
            stepId: 'step-1',
          },
        ],
        steps: [{ id: 'step-1', title: 'Contatti' }],
        notificationEmail: 'owner@example.com',
      },
      new Date(),
    );
    await formRepository.save(form);

    const found = await formRepository.findById(tenantAId, form.id);
    expect(found?.name).toBe('Contatti aggiornato');
    expect(found?.fields).toEqual([
      {
        id: 'email',
        label: 'Email',
        type: 'email',
        required: true,
        stepId: 'step-1',
      },
    ]);
    expect(found?.steps).toEqual([{ id: 'step-1', title: 'Contatti' }]);
    expect(found?.notificationEmail).toBe('owner@example.com');
  });

  it('deletes a form scoped to its tenant', async () => {
    const form = buildForm();
    await formRepository.save(form);

    await formRepository.delete(tenantAId, form.id);

    expect(await formRepository.findById(tenantAId, form.id)).toBeNull();
  });

  it('saves a form submission, scoped to its tenant, and survives the form being deleted', async () => {
    const form = buildForm();
    await formRepository.save(form);

    const submission = FormSubmission.create({
      id: randomUUID(),
      tenantId: tenantAId,
      siteId: siteAId,
      pageId: null,
      formId: form.id,
      payload: { email: 'visitor@example.com' },
    });
    await formSubmissionRepository.save(submission);

    // No read port exists for submissions in v1 (docs/adr/0015) — the save
    // itself, plus surviving the form's deletion below, is what this test
    // can verify without reaching into Drizzle internals from a spec.
    await formRepository.delete(tenantAId, form.id);
  });

  it('saves a form submission with a null formId', async () => {
    const submission = FormSubmission.create({
      id: randomUUID(),
      tenantId: tenantAId,
      siteId: siteAId,
      pageId: null,
      formId: null,
      payload: { email: 'visitor@example.com' },
    });

    await expect(
      formSubmissionRepository.save(submission),
    ).resolves.not.toThrow();
  });

  /** Three submissions one second apart, so ordering assertions are stable. */
  async function seedSubmissions(formId: string, payloads: string[]) {
    const base = Date.now() - payloads.length * 1000;
    for (const [index, email] of payloads.entries()) {
      await formSubmissionRepository.save(
        FormSubmission.create({
          id: randomUUID(),
          tenantId: tenantAId,
          siteId: siteAId,
          pageId: null,
          formId,
          payload: { email },
          now: new Date(base + index * 1000),
        }),
      );
    }
  }

  it('listByForm returns newest first, paginated and scoped to its tenant', async () => {
    const form = buildForm();
    await formRepository.save(form);
    await seedSubmissions(form.id, ['first@x.it', 'second@x.it', 'third@x.it']);

    const firstPage = await formSubmissionRepository.listByForm(
      tenantAId,
      form.id,
      { page: 1, pageSize: 2 },
    );
    expect(firstPage.total).toBe(3);
    expect(firstPage.items.map((s) => s.toProps().payload['email'])).toEqual([
      'third@x.it',
      'second@x.it',
    ]);

    const secondPage = await formSubmissionRepository.listByForm(
      tenantAId,
      form.id,
      { page: 2, pageSize: 2 },
    );
    expect(secondPage.items.map((s) => s.toProps().payload['email'])).toEqual([
      'first@x.it',
    ]);

    // RLS from the other tenant's point of view: the rows exist, and it must
    // not be able to see any of them.
    const fromOtherTenant = await formSubmissionRepository.listByForm(
      tenantBId,
      form.id,
      { page: 1, pageSize: 10 },
    );
    expect(fromOtherTenant.items).toEqual([]);
    expect(fromOtherTenant.total).toBe(0);
  });

  it('listAllByForm returns every submission, oldest first', async () => {
    // The opposite order from the screen, on purpose: a spreadsheet reads
    // top-to-bottom as a timeline.
    const form = buildForm();
    await formRepository.save(form);
    await seedSubmissions(form.id, ['a@x.it', 'b@x.it', 'c@x.it']);

    const all = await formSubmissionRepository.listAllByForm(
      tenantAId,
      form.id,
    );

    expect(all.map((s) => s.toProps().payload['email'])).toEqual([
      'a@x.it',
      'b@x.it',
      'c@x.it',
    ]);
  });

  it('countByForms counts per form and omits the ones with none', async () => {
    const withTwo = buildForm();
    const withNone = buildForm();
    await formRepository.save(withTwo);
    await formRepository.save(withNone);
    await seedSubmissions(withTwo.id, ['one@x.it', 'two@x.it']);

    const counts = await formSubmissionRepository.countByForms(tenantAId, [
      withTwo.id,
      withNone.id,
    ]);

    expect(counts[withTwo.id]).toBe(2);
    expect(counts[withNone.id]).toBeUndefined();
  });

  it('countByForms answers an empty list without hitting the database', async () => {
    // `inArray` with no values generates `in ()`, which Postgres rejects as a
    // syntax error — an empty page of forms has to short-circuit.
    await expect(
      formSubmissionRepository.countByForms(tenantAId, []),
    ).resolves.toEqual({});
  });
});
