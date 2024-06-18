#!/bin/sh

set -x

npx prisma migrate deploy --schema ./packages/prisma/schema.prisma

echo $CERTIFICATE | base64 --decode > /opt/documenso/cert.p12

node apps/web/server.js
