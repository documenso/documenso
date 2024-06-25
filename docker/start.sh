#!/bin/sh

set -x

npx prisma migrate deploy --schema ./packages/prisma/schema.prisma

# Create the directory if it does not exist
mkdir -p /opt/documenso/

echo $CERTIFICATE | jq -r .JULIUSCERTP12 | base64 -d > /opt/documenso/cert.p12

node apps/web/server.js