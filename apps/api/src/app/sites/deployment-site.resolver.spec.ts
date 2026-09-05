import { Site, SiteNotFoundError } from '@brisk/domain-core';
import type { SiteRepositoryPort } from '@brisk/ports';
import { DEFAULT_COOKIE_BANNER_SETTINGS } from '@brisk/shared-types';
import { DeploymentSiteResolver } from './deployment-site.resolver';

function buildSite(id: string, tenantId = 'tenant-1') {
  return Site.fromProps({
    id,
    tenantId,
    name: 'Il mio sito',
    domain: null,
    themeName: 'classic',
    defaultLocale: 'it',
    enabledLocales: ['it'],
    untranslatedPageFallback: 'redirect-to-default',
    businessAddress: null,
    businessPhone: null,
    businessType: null,
    openingHours: null,
    searchEngineIndexingEnabled: false,
    themePrimaryColor: null,
    themeSecondaryColor: null,
    themeFontFamily: null,
    themeCustomCss: null,
    themeHeadScript: null,
    themeBodyScript: null,
    themeFaviconUrl: null,
    themeOverridesEnabled: true,
    themeAllowedTrackerDomains: [],
    formSubmissionRetentionDays: null,
    themeTrackerScripts: [],
    cookieBannerSettings: DEFAULT_COOKIE_BANNER_SETTINGS,
    createdAt: new Date(),
  });
}

function buildRepository(): jest.Mocked<SiteRepositoryPort> {
  return {
    findByDomain: jest.fn(),
    findById: jest.fn(),
    listByTenant: jest.fn(),
    save: jest.fn(),
  };
}

describe('DeploymentSiteResolver', () => {
  it('resolves the tenant’s only site when no id is pinned', async () => {
    const repository = buildRepository();
    const site = buildSite('site-1');
    repository.listByTenant.mockResolvedValue([site]);

    const resolver = new DeploymentSiteResolver(repository, undefined);

    expect(await resolver.require('tenant-1')).toBe(site);
    expect(repository.listByTenant).toHaveBeenCalledWith('tenant-1');
    expect(repository.findById).not.toHaveBeenCalled();
  });

  it('prefers the pinned DEFAULT_SITE_ID over looking one up', async () => {
    const repository = buildRepository();
    const pinned = buildSite('pinned-site');
    repository.findById.mockResolvedValue(pinned);

    const resolver = new DeploymentSiteResolver(repository, 'pinned-site');

    expect(await resolver.require('tenant-1')).toBe(pinned);
    expect(repository.findById).toHaveBeenCalledWith('tenant-1', 'pinned-site');
    expect(repository.listByTenant).not.toHaveBeenCalled();
  });

  // A mistyped id must not quietly become "whichever site happens to be
  // there" — that is how an operator ends up editing the wrong customer's
  // site without ever being told.
  it('fails instead of falling back when the pinned id matches nothing', async () => {
    const repository = buildRepository();
    repository.findById.mockResolvedValue(null);
    repository.listByTenant.mockResolvedValue([buildSite('some-other-site')]);

    const resolver = new DeploymentSiteResolver(repository, 'missing-site');

    await expect(resolver.require('tenant-1')).rejects.toThrow(
      /DEFAULT_SITE_ID is set to missing-site/,
    );
    expect(repository.listByTenant).not.toHaveBeenCalled();
  });

  it('fails loudly rather than picking one when the tenant has several', async () => {
    const repository = buildRepository();
    repository.listByTenant.mockResolvedValue([
      buildSite('site-1'),
      buildSite('site-2'),
    ]);

    const resolver = new DeploymentSiteResolver(repository, undefined);

    await expect(resolver.require('tenant-1')).rejects.toThrow(
      /DEFAULT_SITE_ID/,
    );
  });

  it('fails when the tenant has no site at all', async () => {
    const repository = buildRepository();
    repository.listByTenant.mockResolvedValue([]);

    const resolver = new DeploymentSiteResolver(repository, undefined);

    await expect(resolver.require('tenant-1')).rejects.toThrow(/no site/);
  });

  // A 404 would say "you asked for something that is not there" — but this
  // endpoint takes no id, so there is nothing the caller could have asked
  // for wrongly. Every failure here is the deployment's, not theirs.
  it('never raises the 404-mapped SiteNotFoundError', async () => {
    const repository = buildRepository();
    repository.listByTenant.mockResolvedValue([]);

    const error = await new DeploymentSiteResolver(repository, undefined)
      .require('tenant-1')
      .catch((thrown: unknown) => thrown);

    expect(error).toBeInstanceOf(Error);
    expect(error).not.toBeInstanceOf(SiteNotFoundError);
  });
});
