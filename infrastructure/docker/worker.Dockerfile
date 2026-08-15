FROM oven/bun:1.3.14-alpine AS dev
WORKDIR /workspace
RUN apk add --no-cache vips-dev wget

FROM dev AS build
COPY package.json bunfig.toml turbo.json ./
COPY apps ./apps
COPY packages ./packages
RUN bun install
ENV DIRECT_URL=postgresql://build:build@localhost:5432/build
ENV DATABASE_URL=postgresql://build:build@localhost:5432/build
RUN bun run build:packages
RUN bun --cwd apps/worker build

FROM node:24-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN apk add --no-cache vips && addgroup -S app && adduser -S app -G app
COPY --from=build --chown=app:app /workspace/node_modules ./node_modules
COPY --from=build --chown=app:app /workspace/apps/worker/node_modules ./apps/worker/node_modules
COPY --from=build --chown=app:app /workspace/apps/worker/dist ./apps/worker/dist
COPY --from=build --chown=app:app /workspace/apps/worker/package.json ./apps/worker/package.json
COPY --from=build --chown=app:app /workspace/packages ./packages
USER app
CMD ["node", "apps/worker/dist/main.js"]
