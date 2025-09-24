#!/bin/bash

# =============================================================================
# DOCUMENSO SECRET GENERATOR
# =============================================================================
# This script generates the required secrets for Documenso environment variables

echo "============================================================================="
echo "DOCUMENSO SECRET GENERATOR"
echo "============================================================================="
echo ""
echo "Generating required secrets for your .env file..."
echo ""

# Generate NEXTAUTH_SECRET
NEXTAUTH_SECRET=$(openssl rand -hex 32)
echo "NEXTAUTH_SECRET=\"$NEXTAUTH_SECRET\""

# Generate encryption keys
ENCRYPTION_KEY=$(openssl rand -hex 32)
echo "NEXT_PRIVATE_ENCRYPTION_KEY=\"$ENCRYPTION_KEY\""

SECONDARY_ENCRYPTION_KEY=$(openssl rand -hex 32)
echo "NEXT_PRIVATE_ENCRYPTION_SECONDARY_KEY=\"$SECONDARY_ENCRYPTION_KEY\""

echo ""
echo "============================================================================="
echo "COPY THESE VALUES TO YOUR .env FILE"
echo "============================================================================="
echo ""
echo "Replace the placeholder values in your .env file with the generated secrets above."
echo ""
echo "You can also run this command to update your .env file automatically:"
echo "  ./generate-secrets.sh >> .env.new && mv .env.new .env"
echo ""
