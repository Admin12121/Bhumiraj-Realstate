FROM oven/bun:1.3.14-alpine AS build
WORKDIR /workspace
COPY package.json bunfig.toml turbo.json ./
COPY apps ./apps
COPY packages ./packages
RUN bun install
ENV DIRECT_URL=postgresql://build:build@localhost:5432/build
ENV DATABASE_URL=postgresql://build:build@localhost:5432/build
RUN bun run build:packages
RUN bun --cwd apps/api build

FROM node:24-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup -S app && adduser -S app -G app
COPY --from=build --chown=app:app /workspace/node_modules ./node_modules
COPY --from=build --chown=app:app /workspace/apps/api/node_modules ./apps/api/node_modules
COPY --from=build --chown=app:app /workspace/apps/api/dist ./apps/api/dist
COPY --from=build --chown=app:app /workspace/apps/api/package.json ./apps/api/package.json
COPY --from=build --chown=app:app /workspace/packages ./packages
USER app
EXPOSE 3001
CMD ["node", "apps/api/dist/main.js"]
