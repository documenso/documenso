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

# Check https://github.com/nodejs/docker-node/tree/b4117f9333da4138b03a546ec926ef50a31506c3#nodealpine to understand why libc6-compat might be needed.
RUN apk add --no-cache libc6-compat

# Copy our current monorepo
COPY . .

# Disable husky from installing hooks
ENV HUSKY 0

RUN npm ci

RUN npm run build --workspaces

# Production image, copy all the files and run next
FROM base AS runner
WORKDIR /app

ENV NODE_ENV production
ENV NEXT_TELEMETRY_DISABLED 1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=production_deps --chown=nextjs:nodejs /app/node_modules ./node_modules
COPY --from=production_deps --chown=nextjs:nodejs /app/package-lock.json ./package-lock.json

COPY --from=builder --chown=nextjs:nodejs /app/apps/web/package.json ./package.json
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next ./.next

EXPOSE 3000

ENV PORT 3000

CMD ["npm", "run", "start"]
