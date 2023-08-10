ARG NEXT_PUBLIC_WEBAPP_URL=http://localhost:3000
ARG NEXT_PUBLIC_ALLOW_SIGNUP=true
ARG NEXT_PUBLIC_ALLOW_SUBSCRIPTIONS=false
ARG NEXT_PUBLIC_STRIPE_COMMUNITY_PLAN_MONTHLY_PRICE_ID
ARG NEXT_PUBLIC_STRIPE_COMMUNITY_PLAN_YEARLY_PRICE_ID

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

ARG NEXT_PUBLIC_WEBAPP_URL
ARG NEXT_PUBLIC_ALLOW_SIGNUP
ARG NEXT_PUBLIC_ALLOW_SUBSCRIPTIONS
ARG NEXT_PUBLIC_STRIPE_COMMUNITY_PLAN_MONTHLY_PRICE_ID
ARG NEXT_PUBLIC_STRIPE_COMMUNITY_PLAN_YEARLY_PRICE_ID

WORKDIR /app

# Check https://github.com/nodejs/docker-node/tree/b4117f9333da4138b03a546ec926ef50a31506c3#nodealpine to understand why libc6-compat might be needed.
RUN apk add --no-cache libc6-compat

# Copy our current monorepo
COPY . .

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