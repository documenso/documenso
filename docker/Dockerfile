###########################
#     BASE CONTAINER      #
###########################
# USAR DEBIAN (bookworm) EN VEZ DE ALPINE
FROM node:22-bookworm AS base

# openssl para utilidades (igual que antes)
RUN apt-get update && apt-get install -y --no-install-recommends \
    openssl \
 && rm -rf /var/lib/apt/lists/*


###########################
#    BUILDER CONTAINER    #
###########################
FROM base AS builder

# Herramientas necesarias
RUN apt-get update && apt-get install -y --no-install-recommends \
    jq ca-certificates \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY . .

RUN npm install -g "turbo@^1.9.3"

# Outputs to the /out folder
RUN turbo prune --scope=@documenso/remix --docker


###########################
#   INSTALLER CONTAINER   #
###########################
FROM base AS installer

RUN apt-get update && apt-get install -y --no-install-recommends \
    jq make cmake g++ openssl bash ca-certificates \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Disable husky from installing hooks
ENV HUSKY=0
ENV DOCKER_OUTPUT=1
ENV NEXT_TELEMETRY_DISABLED=1

# Encryption keys (build args)
ARG NEXT_PRIVATE_ENCRYPTION_KEY="CAFEBABE"
ENV NEXT_PRIVATE_ENCRYPTION_KEY="$NEXT_PRIVATE_ENCRYPTION_KEY"
ARG NEXT_PRIVATE_ENCRYPTION_SECONDARY_KEY="DEADBEEF"
ENV NEXT_PRIVATE_ENCRYPTION_SECONDARY_KEY="$NEXT_PRIVATE_ENCRYPTION_SECONDARY_KEY"

# First install the dependencies (as they change less often)
COPY .gitignore .gitignore
COPY --from=builder /app/out/json/ .
COPY --from=builder /app/out/package-lock.json ./package-lock.json
COPY --from=builder /app/lingui.config.ts ./lingui.config.ts

RUN npm ci

# Then copy all the source code (as it changes more often)
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

# No ejecutar como root
RUN addgroup --system --gid 1001 nodejs \
 && adduser  --system --uid 1001 nodejs

# --- PLAYWRIGHT: deps del sistema + navegador ---
# 1) Instalar deps del sistema (root)
USER root
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    libasound2 libatk-bridge2.0-0 libatk1.0-0 \
    libcairo2 libdrm2 libgbm1 libgtk-3-0 \
    libnspr4 libnss3 libxcomposite1 libxdamage1 \
    libxfixes3 libxrandr2 libxshmfence1 \
    fonts-liberation xdg-utils wget \
 && rm -rf /var/lib/apt/lists/*

# 2) Instalar playwright deps (script oficial) y Chromium
RUN npx -y playwright@1.45.0 install-deps
# instalar el navegador en el HOME del usuario nodejs
ENV HOME=/home/nodejs
USER nodejs
RUN npx -y playwright@1.45.0 install chromium
# (Opcional) fija dónde guarda los browsers
ENV PLAYWRIGHT_BROWSERS_PATH=/home/nodejs/.cache/ms-playwright
# --- FIN PLAYWRIGHT ---

WORKDIR /app

# Copiar artefactos como usuario app
COPY --from=builder   --chown=nodejs:nodejs /app/out/json/ ./
COPY --from=builder   --chown=nodejs:nodejs /app/out/full/packages/tailwind-config ./packages/tailwind-config

RUN npm ci --only=production

# Output traces
COPY --from=installer --chown=nodejs:nodejs /app/apps/remix/build   ./apps/remix/build
COPY --from=installer --chown=nodejs:nodejs /app/apps/remix/public  ./apps/remix/public

# Prisma
COPY --from=installer --chown=nodejs:nodejs /app/packages/prisma/schema.prisma   ./packages/prisma/schema.prisma
COPY --from=installer --chown=nodejs:nodejs /app/packages/prisma/migrations     ./packages/prisma/migrations
RUN npx prisma generate --schema ./packages/prisma/schema.prisma

# Start script
COPY --chown=nodejs:nodejs ./docker/start.sh /app/apps/remix/start.sh

WORKDIR /app/apps/remix
CMD ["sh", "start.sh"]
