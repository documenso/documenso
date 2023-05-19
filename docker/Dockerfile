ARG NEXT_PUBLIC_WEBAPP_URL=http://localhost:3000
FROM node:18-alpine AS base

# Install dependencies only when needed
FROM base AS production_deps
WORKDIR /app

# Check https://github.com/nodejs/docker-node/tree/b4117f9333da4138b03a546ec926ef50a31506c3#nodealpine to understand why libc6-compat might be needed.
RUN apk add --no-cache libc6-compat

# Copy our current monorepo
COPY . .

RUN npm ci --production

# Install dependencies only when needed
FROM base AS builder
WORKDIR /app

ENV NEXT_TELEMETRY_DISABLED true
ENV NEXT_PRIVATE_STANDALONE true
ENV NEXT_PUBLIC_WEBAPP_URL $NEXT_PUBLIC_WEBAPP_URL

# Check https://github.com/nodejs/docker-node/tree/b4117f9333da4138b03a546ec926ef50a31506c3#nodealpine to understand why libc6-compat might be needed.
RUN apk add --no-cache libc6-compat

# Copy our current monorepo
COPY . .

RUN npm ci

ENV NODE_ENV production

RUN npm run build --workspaces

# Production image, copy all the files and run next
FROM base AS runner
WORKDIR /app

ENV NODE_ENV production
ENV NEXT_TELEMETRY_DISABLED 1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/public ./apps/web/public
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/static ./apps/web/.next/static

USER nextjs

EXPOSE 3000

ENV PORT 3000

CMD ["node", "apps/web/server.js"]