#!/bin/sh

set -x

npx prisma migrate deploy --schema ./packages/prisma/schema.prisma

node apps/web/server.js
