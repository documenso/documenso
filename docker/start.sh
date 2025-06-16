#!/bin/sh

# Validate certificate setup before starting
printf "Starting Documenso...\n"

# Run certificate validation (non-blocking)
if sh /app/docker/validate-cert.sh; then
    printf "Certificate validation passed - document signing is ready!\n"
else
    printf "Certificate issues detected - please fix before signing documents\n"
    printf "Tip: Documenso will still start and you can use all features except document signing\n"
fi

printf "\nUseful Links:\n"
printf "Documentation: https://docs.documenso.com\n"
printf "Self-hosting guide: https://docs.documenso.com/developers/self-hosting\n"
printf "Certificate setup: https://docs.documenso.com/developers/self-hosting/signing-certificate\n"
printf "Health check: http://localhost:3000/api/health\n"
printf "Certificate status: http://localhost:3000/api/certificate-status\n"
printf "Community: https://github.com/documenso/documenso\n\n"

npx prisma migrate deploy --schema ../../packages/prisma/schema.prisma

HOSTNAME=0.0.0.0 node build/server/main.js
