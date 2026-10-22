# One build for everything: content (downloaded from the official sources), API and web app.
#   docker compose --profile app up -d --build
FROM node:22.22-bookworm-slim AS build
RUN apt-get update && apt-get install -y --no-install-recommends bzip2 ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY packages/content/package.json packages/content/
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN npm ci
COPY . .
# Prisma downloads its migration engine on first use; fetch it now, not at runtime.
RUN cd apps/api && npx prisma version >/dev/null
RUN npm run build:shared \
 && npm run content \
 && npm run build -w @taiwan-mandarin/api \
 && npm run build -w @taiwan-mandarin/web
# The API image needs only runtime packages (the prisma CLI, for migrations, is one).
RUN npm prune --omit=dev

# API: Node, migrations on start. Serves words and the dictionary from the built content.
FROM node:22.22-bookworm-slim AS api
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /app/package.json /app/package-lock.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/packages/shared ./packages/shared
COPY --from=build /app/apps/api ./apps/api
COPY --from=build /app/apps/web/public/content ./apps/web/public/content
COPY --from=build /app/apps/web/public/dict ./apps/web/public/dict
WORKDIR /app/apps/api
EXPOSE 3000
USER node
HEALTHCHECK --interval=15s --timeout=5s --start-period=60s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:3000/health').then(r => r.json()).then(b => process.exit(b.ok ? 0 : 1), () => process.exit(1))"]
# exec: node replaces the shell, so it gets SIGTERM from docker stop and shuts down cleanly.
CMD ["sh", "-c", "npx prisma migrate deploy && exec node dist/main.js"]

# Web: the PWA behind nginx, with /api proxied to the API (same origin, first-party cookie).
FROM nginx:1.27-alpine AS web
COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
COPY deploy/security-headers.conf /etc/nginx/security-headers.conf
COPY --from=build /app/apps/web/dist /usr/share/nginx/html
EXPOSE 80
