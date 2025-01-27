#!/bin/sh

set -x

npx prisma migrate deploy --schema ./packages/prisma/schema.prisma

HOSTNAME=0.0.0.0 node apps/web/server.js
