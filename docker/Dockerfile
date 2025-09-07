###########################
#     BASE CONTAINER      #
###########################
# Usamos Debian (bookworm) en lugar de Alpine para soportar playwright install-deps
FROM node:22-bookworm AS base

RUN apt-get update && apt-get install -y --no-install-recommends \
    openssl ca-certificates \
 && rm -rf /var/lib/apt/lists/*


###########################
#    BUILDER CONTAINER    #
###########################
FROM base AS builder

RUN apt-get update && apt-get install -y --no-install-recommends \
    jq ca-certificates \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY . .

RUN npm install -g "turbo@^1.9.3"

# Outputs to /out (turbo prune)
RUN turbo prune --scope=@documenso/remix --docker


###########################
#   INSTALLER CONTAINER   #
###########################
FROM base AS installer

RUN apt-get update && apt-get install -y --no-install-recommends \
    jq make cmake g++ openssl bash ca-certificates \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Disable husky + telemetría
ENV HUSKY=0
ENV DOCKER_OUTPUT=1
ENV NEXT_TELEMETRY_DISABLED=1

# Encryption keys (solo para build)
ARG NEXT_PRIVATE_ENCRYPTION_KEY="CAFEBABE"
ENV NEXT_PRIVATE_ENCRYPTION_KEY="$NEXT_PRIVATE_ENCRYPTION_KEY"
ARG NEXT_PRIVATE_ENCRYPTION_SECONDARY_KEY="DEADBEEF"
ENV NEXT_PRIVATE_ENCRYPTION_SECONDARY_KEY="$NEXT_PRIVATE_ENCRYPTION_SECONDARY_KEY"

# Instalar deps (cambian menos)
COPY .gitignore .gitignore
COPY --from=builder /app/out/json/ .
COPY --from=builder /app/out/package-lock.json ./package-lock.json
COPY --from=builder /app/lingui.config.ts ./lingui.config.ts

RUN npm ci

# Copiar código y construir
COPY --from=builder /app/out/full/ .
COPY turbo.json turbo.json

RUN npm install -g "turbo@^1.9.3"
RUN turbo run build --filter=@documenso/remix...


###########################
#     RUNNER CONTAINER    #
###########################
FROM base AS runner

ENV HUSKY=0
ENV DOCKER_OUTPUT=1

# Crear usuario de ejecución
RUN addgroup --system --gid 1001 nodejs \
 && adduser  --system --uid 1001 --home /home/nodejs nodejs

# ---- Playwright + Chromium ----
USER root
# Deps de sistema mínimas (install-deps completará el resto)
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates wget \
 && rm -rf /var/lib/apt/lists/*

# Instalar navegadores fuera de /home para evitar permisos
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright

# Instala deps + Chromium y deja permisos al usuario app
RUN npx -y playwright@1.45.0 install-deps \
 && npx -y playwright@1.45.0 install chromium \
 && mkdir -p /home/nodejs \
 && chown -R nodejs:nodejs /home/nodejs /ms-playwright
# ---- fin Playwright ----

USER nodejs
ENV HOME=/home/nodejs
WORKDIR /app

# Artefactos y deps de prod
COPY --from=builder   --chown=nodejs:nodejs /app/out/json/ ./
COPY --from=builder   --chown=nodejs:nodejs /app/out/full/packages/tailwind-config ./packages/tailwind-config
RUN npm ci --only=production

# Build y estáticos
COPY --from=installer --chown=nodejs:nodejs /app/apps/remix/build   ./apps/remix/build
COPY --from=installer --chown=nodejs:nodejs /app/apps/remix/public  ./apps/remix/public

# Prisma
COPY --from=installer --chown=nodejs:nodejs /app/packages/prisma/schema.prisma ./packages/prisma/schema.prisma
COPY --from=installer --chown=nodejs:nodejs /app/packages/prisma/migrations   ./packages/prisma/migrations
RUN npx prisma generate --schema ./packages/prisma/schema.prisma

# Script de arranque
COPY --chown=nodejs:nodejs ./docker/start.sh /app/apps/remix/start.sh

WORKDIR /app/apps/remix
CMD ["sh", "start.sh"]
