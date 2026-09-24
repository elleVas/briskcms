import { describe, expect, it, vi } from 'vitest';
import { FormSubmission, PageTranslation } from '@brisk/domain-core';
import {
  InMemoryFormRepository,
  InMemoryFormSubmissionRepository,
  InMemoryPageTranslationRepository,
} from '@brisk/testing';
import { createForm } from './create-form.use-case';
import {
  exportFormSubmissions,
  listFormSubmissions,
} from './list-form-submissions.use-case';

describe('listFormSubmissions origin pages', () => {
  const tenantId = 'tenant-1';
  const siteId = 'site-1';

  function setup() {
    return {
      formRepository: new InMemoryFormRepository(),
      formSubmissionRepository: new InMemoryFormSubmissionRepository(),
      pageTranslationRepository: new InMemoryPageTranslationRepository(),
    };
  }

  async function seedPage(
    deps: ReturnType<typeof setup>,
    id: string,
    title: string,
    locale = 'it',
  ) {
    const translation = PageTranslation.create({
      id,
      tenantId,
      siteId,
      pageGroupId: `group-${id}`,
      locale,
      slug: title.toLowerCase(),
      seoMeta: { title, description: '' },
      createdBy: null,
    });
    await deps.pageTranslationRepository.save(translation, null);
    return translation;
  }

  async function seedSubmission(
    deps: ReturnType<typeof setup>,
    formId: string,
    pageId: string | null,
    at: string,
  ) {
    await deps.formSubmissionRepository.save(
      FormSubmission.create({
        id: `sub-${at}`,
        tenantId,
        siteId,
        pageId,
        formId,
        payload: { email: 'visitor@example.com' },
        now: new Date(at),
      }),
    );
  }

  it('names each page once however many submissions share it', async () => {
    // The point of the distinct set: a newsletter box in the footer is on
    // every page, and a contact form is on one. Reading the page per
    // submission would be a query per row for no extra information.
    const deps = setup();
    const form = await createForm(deps, {
      tenantId,
      siteId,
      name: 'Contatti',
    });
    await seedPage(deps, 'pt-1', 'Contatti');
    await seedSubmission(deps, form.id, 'pt-1', '2026-03-01T10:00:00.000Z');
    await seedSubmission(deps, form.id, 'pt-1', '2026-03-02T10:00:00.000Z');
    await seedSubmission(deps, form.id, 'pt-1', '2026-03-03T10:00:00.000Z');
    const reads = vi.spyOn(deps.pageTranslationRepository, 'findById');

    const result = await listFormSubmissions(deps, {
      tenantId,
      formId: form.id,
      page: 1,
      pageSize: 20,
    });

    expect(result.pages).toEqual([
      {
        id: 'pt-1',
        pageGroupId: 'group-pt-1',
        locale: 'it',
        title: 'Contatti',
      },
    ]);
    expect(reads).toHaveBeenCalledTimes(1);
  });

  it('returns nothing for submissions that carry no page', async () => {
    const deps = setup();
    const form = await createForm(deps, {
      tenantId,
      siteId,
      name: 'Contatti',
    });
    await seedSubmission(deps, form.id, null, '2026-03-01T10:00:00.000Z');

    const result = await listFormSubmissions(deps, {
      tenantId,
      formId: form.id,
      page: 1,
      pageSize: 20,
    });

    expect(result.items).toHaveLength(1);
    expect(result.pages).toEqual([]);
  });

  it('leaves out a page that no longer exists', async () => {
    const deps = setup();
    const form = await createForm(deps, {
      tenantId,
      siteId,
      name: 'Contatti',
    });
    await seedSubmission(deps, form.id, 'pt-gone', '2026-03-01T10:00:00.000Z');

    const result = await listFormSubmissions(deps, {
      tenantId,
      formId: form.id,
      page: 1,
      pageSize: 20,
    });

    expect(result.items).toHaveLength(1);
    expect(result.pages).toEqual([]);
  });

  it('names only the pages on the requested page of submissions', async () => {
    // A page of results carries the pages that page needs, not the whole
    // form's history — otherwise the first request would read every page
    // the form has ever been on.
    const deps = setup();
    const form = await createForm(deps, {
      tenantId,
      siteId,
      name: 'Contatti',
    });
    await seedPage(deps, 'pt-1', 'Contatti');
    await seedPage(deps, 'pt-2', 'Chi siamo');
    await seedSubmission(deps, form.id, 'pt-1', '2026-03-01T10:00:00.000Z');
    await seedSubmission(deps, form.id, 'pt-2', '2026-03-02T10:00:00.000Z');

    const newest = await listFormSubmissions(deps, {
      tenantId,
      formId: form.id,
      page: 1,
      pageSize: 1,
    });

    expect(newest.pages.map((page) => page.title)).toEqual(['Chi siamo']);
  });

  it('gives the export every page its submissions came from', async () => {
    const deps = setup();
    const form = await createForm(deps, {
      tenantId,
      siteId,
      name: 'Contatti',
    });
    await seedPage(deps, 'pt-1', 'Contatti');
    await seedPage(deps, 'pt-2', 'Chi siamo', 'en');
    await seedSubmission(deps, form.id, 'pt-1', '2026-03-01T10:00:00.000Z');
    await seedSubmission(deps, form.id, 'pt-2', '2026-03-02T10:00:00.000Z');

    const result = await exportFormSubmissions(deps, {
      tenantId,
      formId: form.id,
    });

    expect(
      result.pages.map((page) => `${page.title} (${page.locale})`),
    ).toEqual(['Contatti (it)', 'Chi siamo (en)']);
  });
});
