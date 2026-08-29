# s3-media-storage

`MediaStoragePort` implementation for the curated media library — same
processing pipeline as `@brisk/local-disk-media-storage`, but the
resulting WebP is written to an S3 (or S3-compatible, e.g. MinIO) bucket
instead of the local filesystem. See
[ADR-0013](../../../docs/adr/0013-media-pipeline-local-serving-upload-time-resize.md).
Both this and its LocalDisk sibling **implement the exact same
`MediaStoragePort` interface**, selected per deployment via
`MEDIA_STORAGE_PROVIDER` — a swap, not a code fork.

## Implements

`MediaStoragePort` (`libs/ports/src/lib/media-storage.port.ts`) —
`upload`, `getUrl`, `delete`, `readonly provider = 's3'`.

## How it works

Identical validation/resize/WebP-conversion pipeline to
`LocalDiskMediaStorageAdapter` (reject non-`image/*` with
`UnsupportedMediaTypeError`, EXIF auto-orient, resize only if over
1600px, re-encode to WebP quality 82) — **the pipeline is duplicated
between the two adapters rather than extracted into a shared package**.
That's a deliberate, documented tradeoff: extracting ~15 lines shared
between exactly two adapters would need a whole new Nx library, more
architecture than the duplication currently costs. Revisit if a third
adapter ever needs the same pipeline.

Storage itself uses `@aws-sdk/client-s3`'s `PutObjectCommand`/
`DeleteObjectCommand`. `endpoint`/`forcePathStyle` target an
S3-compatible backend like MinIO instead of real AWS S3 (MinIO requires
path-style bucket URLs; AWS S3 works with either). `delete()` doesn't
special-case a missing key — S3's `DeleteObjectCommand` doesn't error on
one, so no `ENOENT`-style catch is needed (unlike the LocalDisk sibling).

## Configuration

Requires `S3_MEDIA_BUCKET`, `S3_MEDIA_REGION`, `S3_MEDIA_ACCESS_KEY_ID`,
`S3_MEDIA_SECRET_ACCESS_KEY`, `S3_MEDIA_PUBLIC_BASE_URL` (the origin, or a
CDN in front of the bucket, returned URLs are built against), plus
optional `S3_MEDIA_ENDPOINT` and `S3_MEDIA_FORCE_PATH_STYLE`. All only
enforced once `MEDIA_STORAGE_PROVIDER=s3` is selected — a LocalDisk-only
deployment never needs to set S3 credentials just to boot. See
`.env.example`.

## Used by

`apps/api` — used when `MEDIA_STORAGE_PROVIDER=s3`, wired by
`createMediaStorage()` (`apps/api/src/app/media/media.module.ts`).

## Running unit tests

Run `nx test s3-media-storage` to execute the unit tests via [Vitest](https://vitest.dev/).
