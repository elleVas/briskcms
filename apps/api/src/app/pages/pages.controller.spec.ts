import { NotFoundException } from '@nestjs/common';
import { Page } from '@brisk/domain-core';
import type {
  PageRepositoryPort,
  PageVersionRepositoryPort,
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
  let tenantContext: TenantContextPort;
  let controller: PagesController;

  beforeEach(() => {
    pageRepository = {
      save: jest.fn(),
      findById: jest.fn(),
      findBySlug: jest.fn(),
      delete: jest.fn(),
    };
    pageVersionRepository = {
      save: jest.fn(),
      findById: jest.fn(),
      listByPage: jest.fn(),
    };
    tenantContext = { getCurrentTenantId: () => 'tenant-1' };
    controller = new PagesController(
      pageRepository,
      pageVersionRepository,
      tenantContext,
    );
  });

  it('findBySlug throws a NotFoundException when no page matches', async () => {
    pageRepository.findBySlug.mockResolvedValue(null);

    await expect(
      controller.findBySlug('site-1', 'it', 'missing'),
    ).rejects.toThrow(NotFoundException);
  });

  it('saveDraft maps a PageNotFoundError to a NotFoundException', async () => {
    pageRepository.findById.mockResolvedValue(null);

    await expect(
      controller.saveDraft('missing-id', { content: [] }),
    ).rejects.toThrow(NotFoundException);
  });

  it('rollback maps a PageVersionNotFoundError to a NotFoundException', async () => {
    const page = buildPage();
    pageRepository.findById.mockResolvedValue(page);
    pageVersionRepository.findById.mockResolvedValue(null);

    await expect(
      controller.rollback(page.id, { versionId: 'missing-version' }),
    ).rejects.toThrow(NotFoundException);
  });

  it('lets unexpected errors from handleNotFound-wrapped actions propagate unchanged', async () => {
    const page = buildPage();
    pageRepository.findById.mockResolvedValue(page);
    pageRepository.save.mockRejectedValue(new Error('db exploded'));

    await expect(
      controller.saveDraft(page.id, { content: [] }),
    ).rejects.toThrow('db exploded');
  });
});
