# syntax=docker/dockerfile:1
#
# docs/adr/0042. A pure static SPA build — no Node runtime needed to serve
# it, so the runtime stage is nginx, not node:22-alpine (lighter for a
# container whose only job is serving static files + an SPA fallback).
#
# VITE_* vars are compiled into the static bundle at build time (unlike
# apps/public-site's equivalent env vars, read at request time) — changing
# one of these after this image is built means rebuilding it, not just
# restarting the container.

FROM node:22-alpine AS build
WORKDIR /workspace
RUN corepack enable
COPY . .
RUN pnpm install --frozen-lockfile
ARG VITE_API_URL=http://localhost:3000/api
ARG VITE_PUBLIC_SITE_URL=http://localhost:4322
ARG VITE_DEFAULT_SITE_ID
ARG VITE_TURNSTILE_SITE_KEY
ENV VITE_API_URL=${VITE_API_URL} \
    VITE_PUBLIC_SITE_URL=${VITE_PUBLIC_SITE_URL} \
    VITE_DEFAULT_SITE_ID=${VITE_DEFAULT_SITE_ID} \
    VITE_TURNSTILE_SITE_KEY=${VITE_TURNSTILE_SITE_KEY}
RUN pnpm nx run @brisk/editor-app:build

FROM nginx:alpine AS runtime
COPY --from=build /workspace/apps/editor-app/dist/ /usr/share/nginx/html/
COPY apps/editor-app/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
