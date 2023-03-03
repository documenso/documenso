# Docker config for render.com
# Be sure to add an .env config to your docker web service
FROM node:19.5.0-alpine
RUN apk add --no-cache openjdk11

WORKDIR /app

# Inserted from render.com ENV Group
ARG DATABASE_URL
ARG MAIL_FROM
ARG NEXT_PUBLIC_WEBAPP_URL
ARG NEXTAUTH_SECRET
ARG NEXTAUTH_URL
ARG SENDGRID_API_KEY

# Fill docker ENV variables with render.com ENV Group - BUILD-TIME
ENV DATABASE_URL=$DATABASE_URL \
    MAIL_FROM=$ \
    NEXT_PUBLIC_WEBAPP_URL=$NEXT_PUBLIC_WEBAPP_URL \
    NEXTAUTH_SECRET=&NEXTAUTH_SECRET \
    NEXTAUTH_URL=$NEXTAUTH_URL \
    SENDGRID_API_KEY=$SENDGRID_API_KEY

COPY . /app
RUN npm run build

# No runtime ENV Variables set so far besides ENV
ENV NODE_ENV production
EXPOSE 3000
CMD ["npm", "start"]