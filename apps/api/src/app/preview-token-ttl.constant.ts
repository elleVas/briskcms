/**
 * TTL condiviso da entrambe le rotte di creazione token di preview (pagine
 * e site-layout-sections) — una decisione di policy del chiamante
 * (application layer), non dell'adapter (vedi PreviewTokenPort). Un'ora
 * copre comodamente una sessione di editing continuativa; l'editor-app
 * richiede un token nuovo quando riapre l'editor, non tiene aperta la
 * stessa sessione di preview per giorni.
 */
export const PREVIEW_TOKEN_TTL_MS = 1000 * 60 * 60;
