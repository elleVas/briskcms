import { z } from 'zod';
import { pageSlugSchema } from '../pages/page-slug.schemas';

/**
 * A locale tag as a site may store one: `it`, `pt-BR`, and the spellings
 * the site settings accept too (`EN`, `it_IT`) — a bio keyed by the site's
 * own locale must never be refused for how that locale is written.
 */
const LOCALE_KEY = /^[A-Za-z]{2,3}([-_][A-Za-z0-9]{2,8})*$/;

/** A few lines about a person, not an essay: what an author box has room for. */
export const BIO_MAX_CHARS = 1000;

export const updateAccountProfileBodySchema = z.object({
  displayName: z.string().max(120),
  // The same rule as a page's slug: it is one segment of an address.
  slug: pageSlugSchema.nullable(),
  bio: z
    .record(
      z.string().regex(LOCALE_KEY, { message: 'bio keys must be locales' }),
      z.string().max(BIO_MAX_CHARS),
    )
    // More languages than any site publishes is not a bio, it is a payload.
    .refine((bio) => Object.keys(bio).length <= 50, {
      message: 'too many languages',
    }),
});
export type UpdateAccountProfileBody = z.infer<
  typeof updateAccountProfileBodySchema
>;
