import type { OpeningHoursDay, SeoMeta } from '@brisk/shared-types';
import type { PublishedSiteDto } from './public-api-client.js';

const DAY_LABELS: Record<OpeningHoursDay['dayOfWeek'], string> = {
  monday: 'Monday',
  tuesday: 'Tuesday',
  wednesday: 'Wednesday',
  thursday: 'Thursday',
  friday: 'Friday',
  saturday: 'Saturday',
  sunday: 'Sunday',
};

/** Mirrors Site.hasBusinessInfo() in domain-core — re-implemented here since apps/public-site depends only on @brisk/shared-types, never domain-core (see ADR-0007). */
function hasBusinessInfo(site: PublishedSiteDto): boolean {
  return (
    site.businessAddress !== null ||
    site.businessPhone !== null ||
    site.businessType !== null ||
    site.openingHours !== null
  );
}

export interface BuildSchemaOrgGraphInput {
  site: PublishedSiteDto;
  seoMeta: SeoMeta;
  pageUrl: string;
}

/**
 * WebSite + WebPage always; LocalBusiness only when the site has business
 * info filled in (docs/adr/0014). `businessType` (e.g. "Restaurant",
 * "ProfessionalService") is itself a schema.org subtype of LocalBusiness —
 * used directly as @type when set, falling back to plain "LocalBusiness"
 * otherwise. Opening hours: one OpeningHoursSpecification entry per
 * day+range pair, so a midday closure (two ranges on the same day) round-
 * trips correctly.
 */
export function buildSchemaOrgGraph({
  site,
  seoMeta,
  pageUrl,
}: BuildSchemaOrgGraphInput): Record<string, unknown> {
  const websiteId = `${pageUrl}#website`;
  const graph: Record<string, unknown>[] = [
    { '@type': 'WebSite', '@id': websiteId, name: site.name, url: pageUrl },
    {
      '@type': 'WebPage',
      '@id': `${pageUrl}#webpage`,
      url: pageUrl,
      name: seoMeta.title,
      description: seoMeta.description,
      isPartOf: { '@id': websiteId },
    },
  ];

  if (hasBusinessInfo(site)) {
    graph.push({
      '@type': site.businessType ?? 'LocalBusiness',
      '@id': `${pageUrl}#localbusiness`,
      name: site.name,
      url: pageUrl,
      ...(site.businessAddress && { address: site.businessAddress }),
      ...(site.businessPhone && { telephone: site.businessPhone }),
      ...(site.openingHours && {
        openingHoursSpecification: site.openingHours.flatMap((day) =>
          day.ranges.map((range) => ({
            '@type': 'OpeningHoursSpecification',
            dayOfWeek: `https://schema.org/${DAY_LABELS[day.dayOfWeek]}`,
            opens: range.opens,
            closes: range.closes,
          })),
        ),
      }),
    });
  }

  return { '@context': 'https://schema.org', '@graph': graph };
}
