import type {
  DayOfWeek,
  OpeningHoursDay,
  PublishedSite,
  SeoMeta,
} from '@brisk/shared-types';

const SCHEMA_ORG_DAY: Record<DayOfWeek, string> = {
  monday: 'Monday',
  tuesday: 'Tuesday',
  wednesday: 'Wednesday',
  thursday: 'Thursday',
  friday: 'Friday',
  saturday: 'Saturday',
  sunday: 'Sunday',
};

export interface BuildSchemaOrgGraphInput {
  site: PublishedSite;
  seoMeta: SeoMeta;
  pageUrl: string;
}

function hasBusinessInfo(site: PublishedSite): boolean {
  return (
    site.businessAddress !== null ||
    site.businessPhone !== null ||
    site.businessType !== null ||
    site.openingHours !== null
  );
}

function buildLocalBusinessNode(site: PublishedSite): object {
  const business: Record<string, unknown> = {
    // Falls back to the generic schema.org type when the site hasn't set
    // a more specific one (e.g. "Restaurant") — see docs/adr/0014,
    // businessType is a free-text field, not a validated enum, so any
    // non-empty value the site owner entered is trusted as-is.
    '@type': site.businessType || 'LocalBusiness',
    '@id': '#business',
    name: site.name,
  };
  // A single free-text field (docs/adr/0014), not a structured
  // PostalAddress — schema.org accepts a plain string for `address` too,
  // just with less structure than Google's Rich Results guidelines
  // recommend. Revisit if that ever becomes a real limitation.
  if (site.businessAddress) business['address'] = site.businessAddress;
  if (site.businessPhone) business['telephone'] = site.businessPhone;
  if (site.openingHours) {
    business['openingHoursSpecification'] = site.openingHours.flatMap(
      (day: OpeningHoursDay) =>
        day.ranges.map((range) => ({
          '@type': 'OpeningHoursSpecification',
          dayOfWeek: `https://schema.org/${SCHEMA_ORG_DAY[day.dayOfWeek]}`,
          opens: range.opens,
          closes: range.closes,
        })),
    );
  }
  return business;
}

/**
 * WebSite + WebPage always; LocalBusiness only once the site actually has
 * business info set (docs/adr/0014) — a site with none of those fields
 * filled in gets a plain WebSite/WebPage graph, not a broken/empty
 * LocalBusiness node.
 */
export function buildSchemaOrgGraph(input: BuildSchemaOrgGraphInput): object {
  const { site, seoMeta, pageUrl } = input;

  const website = {
    '@type': 'WebSite',
    '@id': '#website',
    name: site.name,
    url: site.domain ? `https://${site.domain}` : pageUrl,
  };
  const webPage = {
    '@type': 'WebPage',
    '@id': `${pageUrl}#webpage`,
    url: pageUrl,
    name: seoMeta.title,
    description: seoMeta.description,
    isPartOf: { '@id': '#website' },
  };

  const graph: object[] = [website, webPage];
  if (hasBusinessInfo(site)) {
    graph.push(buildLocalBusinessNode(site));
  }

  return { '@context': 'https://schema.org', '@graph': graph };
}
