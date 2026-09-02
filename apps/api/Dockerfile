# syntax=docker/dockerfile:1
#
# docs/adr/0042 — built from the full monorepo context (root .dockerignore
# excludes the obvious junk, but every app/lib is still visible: apps/api
# depends on ~20 @brisk/* workspace packages, and Nx's own prune step below
# needs the real dependency graph, not a pre-trimmed one).

FROM node:22-alpine AS build
WORKDIR /workspace
RUN corepack enable
COPY . .
# Nx evaluates every project's config to build its graph, even to build
# just this one — apps/editor-app/vite.config.mts reads the root .env at
# config-load time (a real value, not process.env) and throws on a missing
# VITE_API_URL. .env is deliberately excluded from the build context (real
# secrets shouldn't ship in an image), so a placeholder copy of
# .env.example stands in here purely to satisfy that graph parse — it has
# no effect on this app's own build.
RUN cp .env.example .env
RUN pnpm install --frozen-lockfile
RUN pnpm nx run @brisk/api:build
# Nx's own Docker-prep pattern (@nx/js:prune-lockfile +
# @nx/js:copy-workspace-modules, apps/api/package.json's "prune" target) —
# rewrites every workspace:* dependency to a local file: path and copies
# each @brisk/* package's real source into dist/workspace_modules/, so the
# runtime stage below can `pnpm install` a self-contained, minimal dist/
# without the rest of the monorepo present.
RUN pnpm nx run @brisk/api:prune

FROM node:22-alpine AS runtime
WORKDIR /app
RUN addgroup -S brisk && adduser -S brisk -G brisk
COPY --from=build /workspace/apps/api/dist/ ./
# Nx's prune-lockfile/copy-workspace-modules don't carry the workspace
# root's pnpm-workspace.yaml into the pruned dist/ — but its `overrides`
# (a pinned vite version, unrelated to this app but part of what the
# pruned lockfile was generated against) and `onlyBuiltDependencies:
# [sharp]` (without it, pnpm silently skips sharp's install script and it
# fails at request time instead of here — hit almost exactly this failure
# mode once already for astro:assets) both need to be present for this
# isolated install to reproduce the same one the monorepo itself gets.
COPY --from=build /workspace/pnpm-workspace.yaml ./
# Installed here, inside the target image, on purpose — not copied in from
# the build stage's own node_modules. sharp ships prebuilt native binaries
# per platform (linuxmusl-x64 for this base image); installing on the
# actual target platform is what makes pnpm fetch the right one, instead of
# whatever the build stage's own architecture happened to be.
#
# The pruned package.json here has no "packageManager" field (only the
# monorepo root's does, and that file doesn't ship in this stage) — without
# pinning it explicitly, corepack grabs whatever the latest pnpm is, which
# doesn't necessarily agree with the lockfile @nx/js:prune-lockfile just
# produced (hit this for real: a version drift broke --frozen-lockfile).
RUN corepack enable && corepack prepare pnpm@10.30.3 --activate && pnpm install --prod --frozen-lockfile
USER brisk
EXPOSE 3000
CMD ["node", "main.js"]
