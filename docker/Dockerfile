###########################
#     BASE CONTAINER      #
###########################
FROM node:22-alpine3.22 AS base

RUN apk add --no-cache openssl
RUN apk add --no-cache font-freefont


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
COPY --from=builder /app/patches ./patches

RUN npm ci

# Then copy all the source code (as it changes more often)
COPY --from=builder /app/out/full/ .
# Finally copy the turbo.json file so that we can run turbo commands
COPY turbo.json turbo.json

RUN npm install -g "turbo@^1.9.3"

RUN turbo run build --filter=@documenso/remix...

###########################
#    PROD-DEPS CONTAINER  #
###########################
FROM base AS prod-deps

RUN apk add --no-cache libc6-compat
RUN apk add --no-cache jq
# Required for node_modules/aws-crt
RUN apk add --no-cache make cmake g++ openssl bash

WORKDIR /app

COPY --from=builder /app/out/json/ .
COPY --from=builder /app/out/package-lock.json ./package-lock.json
COPY --from=builder /app/patches ./patches

# Copy schema.prisma to generate client before making node_modules read-only
COPY --from=installer /app/packages/prisma/schema.prisma ./packages/prisma/schema.prisma

# Install production dependencies, generate prisma client, and make node_modules read-only
RUN npm ci --omit=dev --ignore-scripts \
    && npm prune --omit=dev \
    && npx prisma generate --schema ./packages/prisma/schema.prisma \
    && rm -rf ./packages/prisma/schema.prisma \
    && chmod -R a-w /app/node_modules

###########################
#     RUNNER CONTAINER    #
###########################
FROM base AS runner

ENV HUSKY 0
ENV DOCKER_OUTPUT 1

# Don't run production as root
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nodejs

USER nodejs

WORKDIR /app

# Allowlist production-only dependencies and manifests
COPY --from=prod-deps --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nodejs:nodejs /app/out/json/package.json ./package.json
COPY --from=builder --chown=nodejs:nodejs /app/out/json/apps/remix/package.json ./apps/remix/package.json
COPY --from=builder --chown=nodejs:nodejs /app/out/json/packages/prisma/package.json ./packages/prisma/package.json

# Copy Remix build output (absolutely zero original source code)
COPY --from=installer --chown=nodejs:nodejs /app/apps/remix/build ./apps/remix/build
COPY --from=installer --chown=nodejs:nodejs /app/apps/remix/public ./apps/remix/public

# Copy only the schema.prisma needed for the client (migrations are excluded from runtime container)
COPY --from=installer --chown=nodejs:nodejs /app/packages/prisma/schema.prisma ./packages/prisma/schema.prisma

# Get the start script from docker/
COPY --chown=nodejs:nodejs ./docker/start.sh /app/apps/remix/start.sh

WORKDIR /app/apps/remix

CMD ["sh", "start.sh"]


