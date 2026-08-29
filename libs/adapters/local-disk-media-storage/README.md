# local-disk-media-storage

`MediaStoragePort` implementation for the curated media library —
processes every upload and writes it to the local filesystem. The default
backend; see
[ADR-0013](../../../docs/adr/0013-media-pipeline-local-serving-upload-time-resize.md)
for the upload-time-resize design and why it's a fixed-quality WebP
conversion rather than a size ladder. Its sibling
[`@brisk/s3-media-storage`](../s3-media-storage/README.md) is the
S3-compatible alternative — **both implement the exact same
`MediaStoragePort` interface** and share the identical processing
pipeline, so the storage backend is a pure deployment config choice.

## Implements

`MediaStoragePort` (`libs/ports/src/lib/media-storage.port.ts`) —
`upload`, `getUrl`, `delete`, plus a `readonly provider` field (`'local'`)
so callers can record which backend actually stored a given `Media` row
without needing their own separate config.

## How it works

Every upload goes through the same pipeline regardless of source format:

1. Reject anything whose declared `mimeType` doesn't start with
   `image/` — `UnsupportedMediaTypeError` (`@brisk/domain-core`). This
   port is dedicated to images; a PDF/DOCX must go through
   `AttachmentStoragePort` instead.
2. `sharp(...).rotate()` with no arguments — auto-orients from EXIF
   _before_ anything else, otherwise a resize can silently bake in a
   sideways/upside-down photo.
3. Resize only if oversized (`fit: 'inside'`, `withoutEnlargement: true`,
   capped at 1600px on the longer side) — a small image is never
   upscaled.
4. Always re-encode to WebP at quality 82, regardless of the input
   format. The returned `mimeType`/`width`/`height` reflect this output,
   not the original — `UploadMediaResult.mimeType` is never simply the
   caller's declared MIME type echoed back.

One optimized version per upload, not a thumbnail ladder — deliberately
scoped down for now (see ADR-0013 for the rationale and the note on
revisiting if multiple rendition sizes become a real need later).
`delete()` treats an already-missing file (`ENOENT`) as success, matching
`PageRepositoryPort.delete`'s idempotent-from-the-caller's-view semantics
elsewhere in the codebase.

## Configuration

Requires `MEDIA_UPLOAD_DIR` (absolute path files are written to and
served from — `apps/api` serves this directory directly via
`express.static`, no reverse-proxy route needed) and `API_PUBLIC_URL`
(the origin returned URLs are built against). Both only enforced when
`MEDIA_STORAGE_PROVIDER` is unset or `local` — see `.env.example`.

## Used by

`apps/api` — the default (`MEDIA_STORAGE_PROVIDER` unset or `local`),
wired by `createMediaStorage()` (`apps/api/src/app/media/media.module.ts`).

## Running unit tests

Run `nx test local-disk-media-storage` to execute the unit tests via [Vitest](https://vitest.dev/).
