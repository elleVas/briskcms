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
# BRISK_THEME stays a single build-time value until docs/adr/0042's Phase
# 6.5 (multi-theme bundling) lands — see astro.config.mjs's own comment.
ARG BRISK_THEME=classic
ENV BRISK_THEME=${BRISK_THEME}
RUN pnpm nx run @brisk/public-site:build
RUN pnpm --filter @brisk/public-site deploy --prod --legacy /workspace/deploy/public-site
RUN cp -r /workspace/apps/public-site/dist /workspace/deploy/public-site/dist

FROM node:22-alpine AS runtime
WORKDIR /app
RUN addgroup -S brisk && adduser -S brisk -G brisk
COPY --from=build /workspace/deploy/public-site/ ./
USER brisk
EXPOSE 4321
CMD ["node", "server.mjs"]
