#!/bin/sh

npx prisma migrate deploy --schema ./node_modules/.prisma/client/schema.prisma

node apps/web/server.js
