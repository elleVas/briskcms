/**
 * The TTL shared by both preview-token creation routes (pages and
 * site-layout-sections) — a policy decision belonging to the caller (the
 * application layer), not to the adapter (see PreviewTokenPort). An hour
 * comfortably covers one continuous editing session; editor-app requests a
 * fresh token when the editor is reopened, it does not keep the same
 * preview session alive for days.
 */
export const PREVIEW_TOKEN_TTL_MS = 1000 * 60 * 60;
