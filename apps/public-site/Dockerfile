# syntax=docker/dockerfile:1
#
# docs/adr/0042. apps/api has Nx's own prune tooling (prune-lockfile +
# copy-workspace-modules); apps/public-site and apps/editor-app don't, so
# this uses pnpm's own native equivalent instead: `pnpm deploy`. Verified
# directly (not assumed) that `pnpm deploy` respects .gitignore and drops
# the (gitignored) `dist/` build output — it has to be copied in as a
# separate step after the deploy, not before it.
#
# `--legacy`: pnpm 10's default deploy mode requires
# `inject-workspace-packages=true`, a workspace-wide setting that changes
# how every workspace: dependency is linked everywhere, not just for
# Docker builds — too broad a change for what this needs. `--legacy`
# deploys from the existing lockfile/store without that requirement.

FROM node:22-alpine AS build
WORKDIR /workspace
RUN corepack enable
COPY . .
# Nx evaluates every project's config to build its graph, even to build
# just this one — apps/editor-app/vite.config.mts reads the root .env at
# config-load time and throws on a missing VITE_API_URL. .env is
# deliberately excluded from the build context; this placeholder copy of
# .env.example only exists to satisfy that graph parse.
RUN cp .env.example .env
RUN pnpm install --frozen-lockfile
# docs/adr/0042 — every theme under themes/* bundles into this image,
# unconditionally; which one a site renders with is `Site.themeName`,
# resolved per request (theme-registry.ts). `BRISK_THEME` is not a build
# arg: it's an optional *runtime* env var read by that same file to
# restrict which of the bundled themes a deployment will actually serve
# (an agency shipping only its own theme to a client). Deliberately not
# done by pruning themes/ before this build — tried that first and it
# breaks for real: the workspace's own tsconfig project references
# (maintained by `nx sync`) still point at the removed directory, so
# `astro build` fails with "Tsconfig not found /workspace/themes/<name>".
# The themes' own source is a few KB either way; the size argument for
# pruning never justified that fragility.
RUN pnpm nx run @brisk/public-site:build
RUN pnpm --filter @brisk/public-site deploy --prod --legacy /workspace/deploy/public-site
RUN cp -r /workspace/apps/public-site/dist /workspace/deploy/public-site/dist

FROM node:22-alpine AS runtime
WORKDIR /app
RUN addgroup -S brisk && adduser -S brisk -G brisk
COPY --from=build /workspace/deploy/public-site/ ./
USER brisk
# server.mjs falls back to 8080 when neither PUBLIC_SITE_PORT nor PORT is
# set — without this the image would listen on a different port than the
# one it EXPOSEs (and than docker-compose.prod.yml's healthcheck probes),
# so a plain `docker run -p 4321:4321 <image>` answered nothing. Compose
# sets PORT explicitly anyway; this is for everyone who doesn't.
ENV PORT=4321
EXPOSE 4321
CMD ["node", "server.mjs"]
