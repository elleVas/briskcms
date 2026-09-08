/**
 * What a preview token is allowed to unlock. A token is minted for one
 * kind and one id, and validation checks both — so a token for a header
 * cannot be replayed against a page.
 *
 * `section` is the reusable section of docs/adr/0059, previewed in its own
 * editor before it is published onto the pages that use it.
 */
export type PreviewContentType = 'page' | 'header' | 'footer' | 'section';
