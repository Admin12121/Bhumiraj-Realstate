FROM oven/bun:1.3.14-alpine AS dev
WORKDIR /workspace
ENV NEXT_TELEMETRY_DISABLED=1
RUN apk add --no-cache wget

FROM dev AS build
COPY package.json bunfig.toml turbo.json ./
COPY apps ./apps
COPY packages ./packages
RUN bun install
ARG NEXT_PUBLIC_APP_URL
ARG NEXT_PUBLIC_CDN_BASE_URL
ARG NEXT_PUBLIC_UPLOAD_ORIGIN
ARG NEXT_PUBLIC_MAP_STYLE_URL
ENV NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL
ENV NEXT_PUBLIC_CDN_BASE_URL=$NEXT_PUBLIC_CDN_BASE_URL
ENV NEXT_PUBLIC_UPLOAD_ORIGIN=$NEXT_PUBLIC_UPLOAD_ORIGIN
ENV NEXT_PUBLIC_MAP_STYLE_URL=$NEXT_PUBLIC_MAP_STYLE_URL
ENV DIRECT_URL=postgresql://build:build@localhost:5432/build
ENV DATABASE_URL=postgresql://build:build@localhost:5432/build
RUN bun run build:packages
RUN bun --cwd apps/web build

FROM node:24-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0
RUN addgroup -S nextjs && adduser -S nextjs -G nextjs
COPY --from=build --chown=nextjs:nextjs /workspace/apps/web/.next/standalone ./
COPY --from=build --chown=nextjs:nextjs /workspace/apps/web/.next/static ./apps/web/.next/static
COPY --from=build --chown=nextjs:nextjs /workspace/apps/web/public ./apps/web/public
USER nextjs
EXPOSE 3000
CMD ["node", "apps/web/server.js"]
