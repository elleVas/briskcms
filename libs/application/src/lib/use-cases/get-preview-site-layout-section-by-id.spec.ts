import { describe, expect, it } from 'vitest';
import { SiteLayoutSection } from '@brisk/domain-core';
import { getPreviewSiteLayoutSectionById } from './get-preview-site-layout-section-by-id.use-case';
import {
  InMemoryPreviewTokenPort,
  InMemorySiteLayoutSectionRepository,
} from './in-memory-repositories.test-fixture';

describe('getPreviewSiteLayoutSectionById', () => {
  const tenantId = 'tenant-1';

  function setup() {
    return {
      siteLayoutSectionRepository: new InMemorySiteLayoutSectionRepository(),
      previewTokenPort: new InMemoryPreviewTokenPort(),
    };
  }

  async function seedHeader(
    siteLayoutSectionRepository: InMemorySiteLayoutSectionRepository,
  ) {
    const header = SiteLayoutSection.create({
      id: 'header-1',
      tenantId,
      siteId: 'site-1',
      locale: 'it',
      kind: 'header',
    });
    header.saveDraft([{ type: 'Header', props: { label: 'draft header' } }]);
    // Never published — the preview path must show it anyway.
    await siteLayoutSectionRepository.save(header);
    return header;
  }

  it('returns the draft content behind a valid token, even unpublished', async () => {
    const deps = setup();
    await seedHeader(deps.siteLayoutSectionRepository);
    const { token } = await deps.previewTokenPort.createToken(
      tenantId,
      'header',
      'header-1',
      60_000,
    );

    const result = await getPreviewSiteLayoutSectionById(deps, {
      tenantId,
      sectionId: 'header-1',
      token,
    });

    expect(result).toEqual({
      content: [{ type: 'Header', props: { label: 'draft header' } }],
      kind: 'header',
      sticky: false,
      locale: 'it',
    });
  });

  it('returns null for a token issued for the wrong contentType (header vs footer) on the same id', async () => {
    const deps = setup();
    await seedHeader(deps.siteLayoutSectionRepository);
    const { token } = await deps.previewTokenPort.createToken(
      tenantId,
      'footer',
      'header-1',
      60_000,
    );

    expect(
      await getPreviewSiteLayoutSectionById(deps, {
        tenantId,
        sectionId: 'header-1',
        token,
      }),
    ).toBeNull();
  });

  it('returns null for a missing/unknown token', async () => {
    const deps = setup();
    await seedHeader(deps.siteLayoutSectionRepository);

    expect(
      await getPreviewSiteLayoutSectionById(deps, {
        tenantId,
        sectionId: 'header-1',
        token: 'not-a-real-token',
      }),
    ).toBeNull();
  });

  it('returns null for a section id that does not exist', async () => {
    const deps = setup();
    const { token } = await deps.previewTokenPort.createToken(
      tenantId,
      'header',
      'ghost-section',
      60_000,
    );

    expect(
      await getPreviewSiteLayoutSectionById(deps, {
        tenantId,
        sectionId: 'ghost-section',
        token,
      }),
    ).toBeNull();
  });

  it('returns null for a token belonging to a different tenant', async () => {
    const deps = setup();
    await seedHeader(deps.siteLayoutSectionRepository);
    const { token } = await deps.previewTokenPort.createToken(
      'another-tenant',
      'header',
      'header-1',
      60_000,
    );

    expect(
      await getPreviewSiteLayoutSectionById(deps, {
        tenantId,
        sectionId: 'header-1',
        token,
      }),
    ).toBeNull();
  });
});
