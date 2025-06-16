#!/bin/sh

# Certificate validation script for Documenso Docker deployment
# This script checks certificate setup and provides helpful guidance

# Don't exit on errors - we want to start the app even with cert issues
set +e

CERT_PATH="${NEXT_PRIVATE_SIGNING_LOCAL_FILE_PATH:-/opt/documenso/cert.p12}"

printf "Validating certificate setup...\n"

# Check if using base64 encoded certificate contents
if [ -n "$NEXT_PRIVATE_SIGNING_LOCAL_FILE_CONTENTS" ]; then
    printf "Using base64-encoded certificate contents from environment variable\n"
    exit 0
fi

printf "Checking certificate file at: %s\n" "$CERT_PATH"

# Check if certificate file exists
if [ ! -f "$CERT_PATH" ]; then
    printf "ERROR: Certificate file not found at %s\n" "$CERT_PATH"
    printf "\n"
    printf "DOCUMENSO WILL START BUT DOCUMENT SIGNING WILL FAIL!\n"
    printf "\n"
    printf "To fix this issue:\n"
    printf "  1. If using Docker Compose, ensure your .env file contains:\n"
    printf "     NEXT_PRIVATE_SIGNING_LOCAL_FILE_PATH=/opt/documenso/cert.p12\n"
    printf "  2. Update the volume mount in your compose.yml:\n"
    printf "     volumes:\n"
    printf "       - /path/to/your/cert.p12:/opt/documenso/cert.p12:ro\n"
    printf "  3. Ensure the certificate file exists on your host system\n"
    printf "  4. Alternative: Use NEXT_PRIVATE_SIGNING_LOCAL_FILE_CONTENTS with base64 encoded cert\n"
    printf "\n"
    printf "Quick Setup Guide: https://docs.documenso.com/developers/self-hosting/signing-certificate\n"
    printf "Automated Setup: curl -fsSL https://get.documenso.com/setup | sh\n"
    printf "\n"
    return 1
fi

# Check if file is readable
if [ ! -r "$CERT_PATH" ]; then
    printf "ERROR: Certificate file exists but is not readable\n"
    printf "File permissions: %s\n" "$(ls -la "$CERT_PATH")"
    printf "Current user: %s\n" "$(id)"
    printf "\n"
    printf "DOCUMENSO WILL START BUT DOCUMENT SIGNING WILL FAIL!\n"
    printf "\n"
    printf "To fix this issue:\n"
    printf "  1. On host system, ensure certificate file has proper permissions:\n"
    printf "     chmod 644 /path/to/your/cert.p12\n"
    printf "  2. For Docker, ensure proper ownership:\n"
    printf "     chown 1001:1001 /path/to/your/cert.p12\n"
    printf "     OR\n"
    printf "     docker run --user root your-image chown 1001:1001 /opt/documenso/cert.p12\n"
    printf "\n"
    printf "Quick Setup Guide: https://docs.documenso.com/developers/self-hosting/signing-certificate\n"
    printf "\n"
    return 1
fi

# Check file size (basic validation)
FILE_SIZE=$(stat -c%s "$CERT_PATH" 2>/dev/null || stat -f%z "$CERT_PATH" 2>/dev/null || echo "0")
if [ "$FILE_SIZE" -eq 0 ]; then
    printf "ERROR: Certificate file is empty\n"
    printf "\n"
    printf "DOCUMENSO WILL START BUT DOCUMENT SIGNING WILL FAIL!\n"
    printf "\n"
    printf "Please ensure you have a valid .p12 certificate file\n"
    printf "See: https://docs.documenso.com/developers/self-hosting/signing-certificate\n"
    printf "\n"
    return 1
fi

# Test certificate passphrase if provided
if [ -n "$NEXT_PRIVATE_SIGNING_PASSPHRASE" ]; then
    printf "Certificate passphrase is configured\n"
else
    printf "No certificate passphrase configured (this is OK for some certificates)\n"
fi

printf "Certificate validation passed!\n"
printf "File: %s\n" "$CERT_PATH"
printf "Size: %s bytes\n" "$FILE_SIZE"
printf "Owner: %s\n" "$(ls -la "$CERT_PATH" | awk '{print $3":"$4}')"
printf "Permissions: %s\n" "$(ls -la "$CERT_PATH" | awk '{print $1}')"
printf "\n"