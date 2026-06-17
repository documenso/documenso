#!/bin/sh

# 🚀 Starting Documenso...
printf "🚀 Starting Documenso...\n\n"

# 🔐 Check certificate configuration
printf "🔐 Checking certificate configuration...\n"

CERT_PATH="${NEXT_PRIVATE_SIGNING_LOCAL_FILE_PATH:-/opt/documenso/cert.p12}"

if [ -f "$CERT_PATH" ] && [ -r "$CERT_PATH" ]; then
    printf "✅ Certificate file found and readable - document signing is ready!\n"
else
    printf "⚠️ Certificate not found or not readable\n"
    printf "💡 Tip: Documenso will still start, but document signing will be unavailable\n"
    printf "🔧 Check: http://localhost:3000/api/certificate-status for detailed status\n"
fi

printf "\n📚 Useful Links:\n"
printf "📖 Documentation: https://docs.documenso.com\n"
printf "🐳 Self-hosting guide: https://docs.documenso.com/developers/self-hosting\n"
printf "🔐 Certificate setup: https://docs.documenso.com/developers/self-hosting/signing-certificate\n"
printf "🏥 Health check: http://localhost:3000/api/health\n"
printf "📊 Certificate status: http://localhost:3000/api/certificate-status\n"
printf "👥 Community: https://github.com/documenso/documenso\n\n"

if [ -n "${NEXT_PRIVATE_DATABASE_URL:-}" ]; then
  SOCKET_DIR=$(printf '%s' "$NEXT_PRIVATE_DATABASE_URL" | sed -n 's/.*[?&]host=\([^&]*\).*/\1/p')
  if [ -n "$SOCKET_DIR" ]; then
    SOCKET="${SOCKET_DIR}/.s.PGSQL.5432"
    i=0
    while [ $i -lt 30 ]; do
      [ -S "$SOCKET" ] && break
      sleep 1
      i=$((i + 1))
    done
    if [ -S "$SOCKET" ]; then
      printf "✅ Cloud SQL socket ready\n"
    else
      printf "⚠️ Cloud SQL socket not found after 30s — proceeding anyway\n"
    fi
  fi
fi

printf "🗄️  Running database migrations...\n"
npx prisma migrate deploy --schema ../../packages/prisma/schema.prisma || {
  printf "❌ Migration failed — aborting startup\n"
  exit 1
}

printf "🌟 Starting Documenso server...\n"
HOSTNAME=0.0.0.0 node build/server/main.js
