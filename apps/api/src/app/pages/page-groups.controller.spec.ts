import {
  PageGroup,
  PageGroupNotFoundError,
  PageGroupReorderMismatchError,
  PageGroupVersionNotFoundError,
  PageTranslation,
  PageTranslationDivergedError,
  PageTranslationLocaleAlreadyExistsError,
  PageTranslationNotDivergedError,
  PageTranslationNotFoundError,
} from '@brisk/domain-core';
import type {
  PageGroupRepositoryPort,
  PageGroupSummary,
  PageGroupVersionRepositoryPort,
  PageTranslationRepositoryPort,
  PageTranslationVersionRepositoryPort,
  PreviewTokenPort,
  SearchPort,
  TenantContextPort,
} from '@brisk/ports';
import { PageGroupsController } from './page-groups.controller';

function buildGroup(
  overrides: Partial<Parameters<typeof PageGroup.create>[0]> = {},
) {
  return PageGroup.create({
    id: 'group-1',
    tenantId: 'tenant-1',
    siteId: 'site-1',
    ...overrides,
  });
}

function buildTranslation(
  overrides: Partial<Parameters<typeof PageTranslation.create>[0]> = {},
) {
  return PageTranslation.create({
    id: 'translation-1',
    tenantId: 'tenant-1',
    siteId: 'site-1',
    pageGroupId: 'group-1',
    locale: 'en',
    slug: 'home',
    seoMeta: { title: 'Home', description: '' },
    ...overrides,
  });
}

describe('PageGroupsController (unit)', () => {
  let pageGroupRepository: jest.Mocked<PageGroupRepositoryPort>;
  let pageGroupVersionRepository: jest.Mocked<PageGroupVersionRepositoryPort>;
  let pageTranslationRepository: jest.Mocked<PageTranslationRepositoryPort>;
  let pageTranslationVersionRepository: jest.Mocked<PageTranslationVersionRepositoryPort>;
  let tenantContext: TenantContextPort;
  let previewTokenPort: jest.Mocked<PreviewTokenPort>;
  let searchPort: jest.Mocked<SearchPort>;
  let controller: PageGroupsController;

  beforeEach(() => {
    pageGroupRepository = {
      save: jest.fn(),
      saveWithVersion: jest.fn(),
      findById: jest.fn(),
      listBySite: jest.fn(),
      listBySiteFiltered: jest.fn(),
      listSiblings: jest.fn(),
      delete: jest.fn(),
    };
    pageGroupVersionRepository = {
      save: jest.fn(),
      findById: jest.fn(),
      listByGroup: jest.fn(),
    };
    pageTranslationRepository = {
      save: jest.fn(),
      saveWithVersion: jest.fn(),
      findById: jest.fn(),
      findByGroupAndLocale: jest.fn(),
      listByGroup: jest.fn(),
      findByParentGroupAndLocaleSlug: jest.fn(),
      delete: jest.fn(),
    };
    pageTranslationVersionRepository = {
      save: jest.fn(),
      findById: jest.fn(),
      listByTranslation: jest.fn(),
    };
    tenantContext = {
      getCurrentTenantId: () => 'tenant-1',
      getCurrentUserId: () => 'user-1',
    };
    previewTokenPort = {
      createToken: jest.fn(),
      validateToken: jest.fn(),
    };
    searchPort = {
      indexPage: jest.fn(),
      search: jest.fn(),
    };
    controller = new PageGroupsController(
      pageGroupRepository,
      pageGroupVersionRepository,
      pageTranslationRepository,
      pageTranslationVersionRepository,
      tenantContext,
      previewTokenPort,
      searchPort,
    );
  });

  it('list threads pagination and every filter through to the repository', async () => {
    pageGroupRepository.listBySiteFiltered.mockResolvedValue({
      items: [],
      total: 0,
    });

    await controller.list({
      siteId: 'site-1',
      page: 2,
      pageSize: 10,
      search: 'chi siamo',
      createdAfter: new Date('2026-01-01'),
      createdBefore: new Date('2026-02-01'),
      createdBy: 'user-1',
      locale: 'it',
    });

    expect(pageGroupRepository.listBySiteFiltered).toHaveBeenCalledWith(
      'tenant-1',
      'site-1',
      { page: 2, pageSize: 10 },
      {
        search: 'chi siamo',
        createdAfter: new Date('2026-01-01'),
        createdBefore: new Date('2026-02-01'),
        createdBy: 'user-1',
        locale: 'it',
      },
    );
  });

  it('list returns one row per group with its translations', async () => {
    const createdAt = new Date();
    pageGroupRepository.listBySiteFiltered.mockResolvedValue({
      items: [
        {
          id: 'group-1',
          tenantId: 'tenant-1',
          siteId: 'site-1',
          parentId: null,
          order: 0,
          createdBy: 'user-1',
          createdByName: 'Ada Lovelace',
          createdAt,
          updatedAt: createdAt,
          translations: [
            {
              locale: 'it',
              slug: 'home',
              title: 'Home',
              status: 'published',
              isDiverged: false,
            },
          ],
        },
      ],
      total: 1,
    });

    const result = await controller.list({
      siteId: 'site-1',
      page: 1,
      pageSize: 20,
    });

    expect(result.total).toBe(1);
    expect(result.items[0]).toMatchObject({
      id: 'group-1',
      createdByName: 'Ada Lovelace',
      translations: [
        {
          locale: 'it',
          slug: 'home',
          title: 'Home',
          status: 'published',
          isDiverged: false,
        },
      ],
    });
  });

  it('rollback restores the group content from a version belonging to it', async () => {
    const group = buildGroup({
      content: [{ id: 'block-1', type: 'Hero', props: { title: 'Current' } }],
    });
    pageGroupRepository.findById.mockResolvedValue(group);
    pageGroupVersionRepository.findById.mockResolvedValue({
      id: 'version-1',
      tenantId: 'tenant-1',
      pageGroupId: 'group-1',
      content: [{ id: 'block-1', type: 'Hero', props: { title: 'Old' } }],
      createdBy: null,
      createdAt: new Date(),
    });

    const result = await controller.rollback('group-1', {
      versionId: 'version-1',
    });

    expect(result.content).toEqual([
      { id: 'block-1', type: 'Hero', props: { title: 'Old' } },
    ]);
    expect(pageGroupRepository.saveWithVersion).toHaveBeenCalled();
  });

  it('rollback propagates PageGroupVersionNotFoundError for a version belonging to another group, unwrapped', async () => {
    pageGroupRepository.findById.mockResolvedValue(buildGroup());
    pageGroupVersionRepository.findById.mockResolvedValue({
      id: 'version-1',
      tenantId: 'tenant-1',
      pageGroupId: 'some-other-group',
      content: [],
      createdBy: null,
      createdAt: new Date(),
    });

    await expect(
      controller.rollback('group-1', { versionId: 'version-1' }),
    ).rejects.toThrow(PageGroupVersionNotFoundError);
  });

  function buildSummary(
    overrides: Partial<PageGroupSummary> = {},
  ): PageGroupSummary {
    return {
      id: 'group-1',
      tenantId: 'tenant-1',
      siteId: 'site-1',
      parentId: null,
      order: 0,
      createdBy: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    };
  }

  it('reorder threads siteId/parentId/orderedPageGroupIds through to the use-case', async () => {
    pageGroupRepository.listSiblings.mockResolvedValue([
      buildSummary({ id: 'a' }),
      buildSummary({ id: 'b' }),
    ]);

    await controller.reorder({
      siteId: 'site-1',
      parentId: null,
      orderedPageGroupIds: ['b', 'a'],
    });

    expect(pageGroupRepository.listSiblings).toHaveBeenCalledWith(
      'tenant-1',
      'site-1',
      null,
    );
  });

  it('reorder propagates PageGroupReorderMismatchError, unwrapped', async () => {
    pageGroupRepository.listSiblings.mockResolvedValue([buildSummary()]);

    await expect(
      controller.reorder({
        siteId: 'site-1',
        parentId: null,
        orderedPageGroupIds: ['not-a-real-sibling'],
      }),
    ).rejects.toThrow(PageGroupReorderMismatchError);
  });

  it('duplicate copies the source group and every translation', async () => {
    const source = buildGroup({
      content: [{ id: 'block-1', type: 'Hero', props: { title: 'Hello' } }],
    });
    pageGroupRepository.findById.mockResolvedValue(source);
    pageGroupRepository.listSiblings.mockResolvedValue([]);
    pageTranslationRepository.listByGroup.mockResolvedValue([
      buildTranslation({ locale: 'en', slug: 'home' }),
    ]);
    pageTranslationRepository.findByParentGroupAndLocaleSlug.mockResolvedValue(
      null,
    );

    const result = await controller.duplicate('group-1');

    expect(result.content).toEqual(source.content);
    expect(pageTranslationRepository.save).toHaveBeenCalled();
  });

  it('duplicate propagates PageGroupNotFoundError, unwrapped', async () => {
    pageGroupRepository.findById.mockResolvedValue(null);

    await expect(controller.duplicate('missing-id')).rejects.toThrow(
      PageGroupNotFoundError,
    );
  });

  it('delete propagates PageGroupNotFoundError, unwrapped', async () => {
    pageGroupRepository.findById.mockResolvedValue(null);

    await expect(controller.delete('missing-id')).rejects.toThrow(
      PageGroupNotFoundError,
    );
  });

  it('delete calls the repository once the group is found', async () => {
    pageGroupRepository.findById.mockResolvedValue(buildGroup());

    await controller.delete('group-1');

    expect(pageGroupRepository.delete).toHaveBeenCalledWith(
      'tenant-1',
      'group-1',
    );
  });

  it('findById propagates PageGroupNotFoundError, unwrapped', async () => {
    pageGroupRepository.findById.mockResolvedValue(null);

    await expect(controller.findById('missing-id')).rejects.toThrow(
      PageGroupNotFoundError,
    );
  });

  it('saveContent propagates PageGroupNotFoundError, unwrapped', async () => {
    pageGroupRepository.findById.mockResolvedValue(null);

    await expect(
      controller.saveContent('missing-id', { content: [] }),
    ).rejects.toThrow(PageGroupNotFoundError);
  });

  it('createTranslation propagates PageGroupNotFoundError, unwrapped', async () => {
    pageGroupRepository.findById.mockResolvedValue(null);

    await expect(
      controller.createTranslation('missing-id', {
        locale: 'en',
        slug: 'home',
        seoMeta: { title: 'Home', description: '' },
      }),
    ).rejects.toThrow(PageGroupNotFoundError);
  });

  it('createTranslation propagates PageTranslationLocaleAlreadyExistsError, unwrapped', async () => {
    pageGroupRepository.findById.mockResolvedValue(buildGroup());
    pageTranslationRepository.findByGroupAndLocale.mockResolvedValue(
      buildTranslation(),
    );

    await expect(
      controller.createTranslation('group-1', {
        locale: 'en',
        slug: 'home-2',
        seoMeta: { title: 'Home', description: '' },
      }),
    ).rejects.toThrow(PageTranslationLocaleAlreadyExistsError);
  });

  it('saveFieldValues propagates PageTranslationNotFoundError, unwrapped', async () => {
    pageTranslationRepository.findById.mockResolvedValue(null);

    await expect(
      controller.saveFieldValues('missing-id', {
        fieldValues: {},
        parentGroupId: null,
      }),
    ).rejects.toThrow(PageTranslationNotFoundError);
  });

  it('saveFieldValues propagates PageTranslationDivergedError once diverged, unwrapped', async () => {
    const diverged = buildTranslation();
    diverged.diverge([]);
    pageTranslationRepository.findById.mockResolvedValue(diverged);

    await expect(
      controller.saveFieldValues('translation-1', {
        fieldValues: {},
        parentGroupId: null,
      }),
    ).rejects.toThrow(PageTranslationDivergedError);
  });

  it('saveDivergedContent propagates PageTranslationNotDivergedError on a still-linked translation, unwrapped', async () => {
    pageTranslationRepository.findById.mockResolvedValue(buildTranslation());

    await expect(
      controller.saveDivergedContent('translation-1', {
        content: [],
        parentGroupId: null,
      }),
    ).rejects.toThrow(PageTranslationNotDivergedError);
  });

  it('saveDivergedContent saves independent content on an already-diverged translation', async () => {
    const diverged = buildTranslation();
    diverged.diverge([]);
    pageTranslationRepository.findById.mockResolvedValue(diverged);

    const result = await controller.saveDivergedContent('translation-1', {
      content: [{ type: 'Text', props: { body: 'x' } }],
      parentGroupId: null,
    });

    expect(result.divergedContent).toEqual([
      { type: 'Text', props: { body: 'x' } },
    ]);
  });

  it('publish propagates PageTranslationNotFoundError, unwrapped', async () => {
    pageTranslationRepository.findById.mockResolvedValue(null);

    await expect(controller.publish('missing-id')).rejects.toThrow(
      PageTranslationNotFoundError,
    );
  });

  it('publish freezes the merged group+fieldValues content', async () => {
    const group = buildGroup({
      content: [{ id: 'block-1', type: 'Hero', props: { title: 'Hello' } }],
    });
    const translation = buildTranslation({
      fieldValues: { 'block-1': { title: 'Ciao' } },
    });
    pageTranslationRepository.findById.mockResolvedValue(translation);
    pageGroupRepository.findById.mockResolvedValue(group);

    const result = await controller.publish('translation-1');

    expect(result.status).toBe('published');
    expect(result.publishedSnapshot).toEqual([
      { id: 'block-1', type: 'Hero', props: { title: 'Ciao' } },
    ]);
  });

  it('createPreviewToken propagates PageTranslationNotFoundError, unwrapped', async () => {
    pageTranslationRepository.findById.mockResolvedValue(null);

    await expect(controller.createPreviewToken('missing-id')).rejects.toThrow(
      PageTranslationNotFoundError,
    );
    expect(previewTokenPort.createToken).not.toHaveBeenCalled();
  });

  it("createPreviewToken issues a token scoped to (tenant, 'page', translationId)", async () => {
    pageTranslationRepository.findById.mockResolvedValue(buildTranslation());
    const expiresAt = new Date();
    previewTokenPort.createToken.mockResolvedValue({
      token: 'opaque-token',
      tenantId: 'tenant-1',
      contentType: 'page',
      contentId: 'translation-1',
      expiresAt,
    });

    const result = await controller.createPreviewToken('translation-1');

    expect(previewTokenPort.createToken).toHaveBeenCalledWith(
      'tenant-1',
      'page',
      'translation-1',
      expect.any(Number),
    );
    expect(result).toEqual({ token: 'opaque-token', expiresAt });
  });

  it('diverge propagates PageTranslationDivergedError if already diverged, unwrapped', async () => {
    const diverged = buildTranslation();
    diverged.diverge([]);
    pageTranslationRepository.findById.mockResolvedValue(diverged);

    await expect(controller.diverge('translation-1')).rejects.toThrow(
      PageTranslationDivergedError,
    );
  });

  it('lets unexpected errors propagate unchanged', async () => {
    pageGroupRepository.findById.mockResolvedValue(buildGroup());
    pageGroupRepository.saveWithVersion.mockRejectedValue(
      new Error('db exploded'),
    );

    await expect(
      controller.saveContent('group-1', { content: [] }),
    ).rejects.toThrow('db exploded');
  });
});
