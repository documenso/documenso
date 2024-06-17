#!/bin/sh

set -x

echo ${CERT_P12} | base64 --decode > /opt/documenso/cert.p12

npx prisma migrate deploy --schema ./packages/prisma/schema.prisma

node apps/web/server.js
