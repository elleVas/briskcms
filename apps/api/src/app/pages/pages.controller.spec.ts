import {
  Page,
  PageNotFoundError,
  PageSlugAlreadyExistsError,
  PageTranslationAlreadyExistsError,
  PageVersionNotFoundError,
} from '@brisk/domain-core';
import type {
  PageRepositoryPort,
  PageVersionRepositoryPort,
  PreviewTokenPort,
  SearchPort,
  TenantContextPort,
} from '@brisk/ports';
import { PagesController } from './pages.controller.js';

function buildPage(overrides: Partial<Parameters<typeof Page.create>[0]> = {}) {
  return Page.create({
    id: 'page-1',
    tenantId: 'tenant-1',
    siteId: 'site-1',
    groupId: 'group-1',
    locale: 'it',
    slug: 'home',
    seoMeta: { title: 'Home', description: 'La home del sito' },
    ...overrides,
  });
}

describe('PagesController (unit)', () => {
  let pageRepository: jest.Mocked<PageRepositoryPort>;
  let pageVersionRepository: jest.Mocked<PageVersionRepositoryPort>;
  let searchPort: jest.Mocked<SearchPort>;
  let tenantContext: TenantContextPort;
  let previewTokenPort: jest.Mocked<PreviewTokenPort>;
  let controller: PagesController;

  beforeEach(() => {
    pageRepository = {
      save: jest.fn(),
      saveWithVersion: jest.fn(),
      findById: jest.fn(),
      findByParentAndSlug: jest.fn(),
      listBySite: jest.fn(),
      listByGroup: jest.fn(),
      delete: jest.fn(),
    };
    pageVersionRepository = {
      save: jest.fn(),
      findById: jest.fn(),
      listByPage: jest.fn(),
    };
    searchPort = {
      indexPage: jest.fn(),
      search: jest.fn(),
    };
    tenantContext = { getCurrentTenantId: () => 'tenant-1' };
    previewTokenPort = {
      createToken: jest.fn(),
      validateToken: jest.fn(),
    };
    controller = new PagesController(
      pageRepository,
      pageVersionRepository,
      searchPort,
      tenantContext,
      previewTokenPort,
    );
  });

  it('findBySlug propagates PageNotFoundError, unwrapped', async () => {
    pageRepository.findByParentAndSlug.mockResolvedValue(null);

    await expect(
      controller.findBySlug('site-1', 'it', 'missing'),
    ).rejects.toThrow(PageNotFoundError);
  });

  // The mapping to the right HTTP status now happens in the global
  // HttpExceptionFilter (see http-exception.filter.spec.ts), not here —
  // the controller's own contract is just to let the domain error
  // propagate unwrapped.
  it('saveDraft propagates PageNotFoundError, unwrapped', async () => {
    pageRepository.findById.mockResolvedValue(null);

    await expect(
      controller.saveDraft('missing-id', { content: [] }),
    ).rejects.toThrow(PageNotFoundError);
  });

  it('rollback propagates PageVersionNotFoundError, unwrapped', async () => {
    const page = buildPage();
    pageRepository.findById.mockResolvedValue(page);
    pageVersionRepository.findById.mockResolvedValue(null);

    await expect(
      controller.rollback(page.id, { versionId: 'missing-version' }),
    ).rejects.toThrow(PageVersionNotFoundError);
  });

  it('lets unexpected errors propagate unchanged', async () => {
    const page = buildPage();
    pageRepository.findById.mockResolvedValue(page);
    pageRepository.saveWithVersion.mockRejectedValue(new Error('db exploded'));

    await expect(
      controller.saveDraft(page.id, { content: [] }),
    ).rejects.toThrow('db exploded');
  });

  it('delete propagates PageNotFoundError, unwrapped', async () => {
    pageRepository.findById.mockResolvedValue(null);

    await expect(controller.delete('missing-id')).rejects.toThrow(
      PageNotFoundError,
    );
  });

  it('create propagates PageSlugAlreadyExistsError, unwrapped', async () => {
    pageRepository.findByParentAndSlug.mockResolvedValue(buildPage());

    await expect(
      controller.create({
        siteId: 'site-1',
        groupId: 'group-2',
        locale: 'it',
        slug: 'home',
        seoMeta: { title: 'Home again', description: '...' },
      }),
    ).rejects.toThrow(PageSlugAlreadyExistsError);
  });

  it('createTranslation propagates PageTranslationAlreadyExistsError, unwrapped', async () => {
    pageRepository.findById.mockResolvedValue(buildPage());
    pageRepository.listByGroup.mockResolvedValue([buildPage()]);

    await expect(
      controller.createTranslation('page-1', { locale: 'it', slug: 'home-en' }),
    ).rejects.toThrow(PageTranslationAlreadyExistsError);
  });

  it('duplicate propagates PageNotFoundError, unwrapped', async () => {
    pageRepository.findById.mockResolvedValue(null);

    await expect(
      controller.duplicate('missing-id', {
        slug: 'home-copia',
        title: 'Home (copia)',
        description: '',
      }),
    ).rejects.toThrow(PageNotFoundError);
  });

  it('duplicate propagates PageSlugAlreadyExistsError, unwrapped', async () => {
    pageRepository.findById.mockResolvedValue(buildPage());
    pageRepository.findByParentAndSlug.mockResolvedValue(
      buildPage({ id: 'page-2' }),
    );

    await expect(
      controller.duplicate('page-1', {
        slug: 'home',
        title: 'Home (copia)',
        description: '',
      }),
    ).rejects.toThrow(PageSlugAlreadyExistsError);
  });

  it('duplicate saves an independent draft copy and returns it', async () => {
    const source = buildPage({
      content: [{ type: 'Hero', props: { title: 'Ciao' } }],
    });
    pageRepository.findById.mockResolvedValue(source);
    pageRepository.findByParentAndSlug.mockResolvedValue(null);

    const result = await controller.duplicate('page-1', {
      slug: 'home-copia',
      title: 'Home (copia)',
      description: 'Nuova descrizione',
    });

    expect(result.id).not.toBe(source.id);
    expect(result.slug).toBe('home-copia');
    expect(result.status).toBe('draft');
    expect(pageRepository.saveWithVersion).toHaveBeenCalled();
  });

  it('createPreviewToken propagates PageNotFoundError, unwrapped', async () => {
    pageRepository.findById.mockResolvedValue(null);

    await expect(controller.createPreviewToken('missing-id')).rejects.toThrow(
      PageNotFoundError,
    );
    expect(previewTokenPort.createToken).not.toHaveBeenCalled();
  });

  it("createPreviewToken issues a token scoped to (tenant, 'page', pageId)", async () => {
    const page = buildPage();
    pageRepository.findById.mockResolvedValue(page);
    const expiresAt = new Date();
    previewTokenPort.createToken.mockResolvedValue({
      token: 'opaque-token',
      tenantId: 'tenant-1',
      contentType: 'page',
      contentId: page.id,
      expiresAt,
    });

    const result = await controller.createPreviewToken(page.id);

    expect(previewTokenPort.createToken).toHaveBeenCalledWith(
      'tenant-1',
      'page',
      page.id,
      expect.any(Number),
    );
    expect(result).toEqual({ token: 'opaque-token', expiresAt });
  });
});
