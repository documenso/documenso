#!/bin/sh

set -x

npx prisma migrate deploy --schema ./packages/prisma/schema.prisma

echo ${cert_file} | base64 --decode > /opt/documenso/cert.p12

node apps/web/server.js
