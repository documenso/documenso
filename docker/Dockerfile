###########################
#     BASE CONTAINER      #
###########################
FROM node:22-alpine3.20 AS base

RUN apk add --no-cache openssl


###########################
#    BUILDER CONTAINER    #
###########################
FROM base AS builder

# Check https://github.com/nodejs/docker-node/tree/b4117f9333da4138b03a546ec926ef50a31506c3#nodealpine to understand why libc6-compat might be needed.
RUN apk add --no-cache libc6-compat
RUN apk add --no-cache jq
WORKDIR /app

COPY . .

RUN npm install -g "turbo@^1.9.3"

# Outputs to the /out folder
# source: https://turbo.build/repo/docs/reference/command-line-reference/prune#--docker
RUN turbo prune --scope=@documenso/remix --docker

###########################
#   INSTALLER CONTAINER   #
###########################
FROM base AS installer

# Check https://github.com/nodejs/docker-node/tree/b4117f9333da4138b03a546ec926ef50a31506c3#nodealpine to understand why libc6-compat might be needed.
RUN apk add --no-cache libc6-compat
RUN apk add --no-cache jq
# Required for node_modules/aws-crt
RUN apk add --no-cache make cmake g++ openssl bash

WORKDIR /app

# Disable husky from installing hooks
ENV HUSKY 0
ENV DOCKER_OUTPUT 1
ENV NEXT_TELEMETRY_DISABLED 1

# Encryption keys
ARG NEXT_PRIVATE_ENCRYPTION_KEY="CAFEBABE"
ENV NEXT_PRIVATE_ENCRYPTION_KEY="$NEXT_PRIVATE_ENCRYPTION_KEY"

ARG NEXT_PRIVATE_ENCRYPTION_SECONDARY_KEY="DEADBEEF"
ENV NEXT_PRIVATE_ENCRYPTION_SECONDARY_KEY="$NEXT_PRIVATE_ENCRYPTION_SECONDARY_KEY"


# Uncomment and use build args to enable remote caching
# ARG TURBO_TEAM
# ENV TURBO_TEAM=$TURBO_TEAM
# ARG TURBO_TOKEN
# ENV TURBO_TOKEN=$TURBO_TOKEN

# First install the dependencies (as they change less often)
COPY .gitignore .gitignore
COPY --from=builder /app/out/json/ .
COPY --from=builder /app/out/package-lock.json ./package-lock.json

COPY --from=builder /app/lingui.config.ts ./lingui.config.ts

RUN npm ci

# Then copy all the source code (as it changes more often)
COPY --from=builder /app/out/full/ .
# Finally copy the turbo.json file so that we can run turbo commands
COPY turbo.json turbo.json

RUN npm install -g "turbo@^1.9.3"

RUN turbo run build --filter=@documenso/remix...

###########################
#     RUNNER CONTAINER    #
###########################
# Mantén Node 22 en runtime (como antes), pero en Debian para poder instalar deps
FROM node:22-bullseye-slim AS runner

ENV HUSKY=0 DOCKER_OUTPUT=1

# Crea el mismo usuario 1001 que usabas (así coinciden permisos del .p12)
RUN addgroup --system --gid 1001 nodejs \
 && adduser  --system --uid 1001 nodejs

USER nodejs
WORKDIR /app

# Instalar dependencias del sistema que Playwright necesita
USER root
RUN apt-get update \
 && apt-get install -y --no-install-recommends ca-certificates curl git \
 && rm -rf /var/lib/apt/lists/*

# Instalar dependencias y navegadores de Playwright EN RUNTIME
# (pin al mismo mayor de playwright que uses en build; 1.45.0 si quieres)
RUN npx -y playwright@1.45.0 install-deps \
 && npx -y playwright@1.45.0 install chromium

# Volver al usuario no-root 1001
USER nodejs

# === A partir de aquí, tu flujo original ===

# Artefactos mínimos
COPY --from=builder --chown=nodejs:nodejs /app/out/json/ .
COPY --from=builder --chown=nodejs:nodejs /app/out/full/packages/tailwind-config ./packages/tailwind-config

# Dependencias de producción
RUN npm ci --only=production

# Build y estáticos generados en installer
COPY --from=installer --chown=nodejs:nodejs /app/apps/remix/build ./apps/remix/build
COPY --from=installer --chown=nodejs:nodejs /app/apps/remix/public ./apps/remix/public

# Prisma: schema + migrations, y generar cliente para linux-gnu (Debian)
COPY --from=installer --chown=nodejs:nodejs /app/packages/prisma/schema.prisma ./packages/prisma/schema.prisma
COPY --from=installer --chown=nodejs:nodejs /app/packages/prisma/migrations ./packages/prisma/migrations
RUN npx prisma generate --schema ./packages/prisma/schema.prisma

# Script de arranque
COPY --chown=nodejs:nodejs ./docker/start.sh /app/apps/remix/start.sh

WORKDIR /app/apps/remix
CMD ["sh", "start.sh"]
