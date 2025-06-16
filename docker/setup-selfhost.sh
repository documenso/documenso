#!/bin/bash

# Documenso Self-Hosting Setup Script
# This script helps configure Documenso for self-hosting with proper certificate setup

set -e

echo ""
echo "🐳 Documenso Self-Hosting Setup"
echo "================================"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Helper functions
print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_info() {
    echo -e "ℹ️  $1"
}

# Check if Docker and Docker Compose are installed
check_dependencies() {
    print_info "Checking dependencies..."
    
    if ! command -v docker &> /dev/null; then
        print_error "Docker is not installed. Please install Docker first."
        exit 1
    fi
    
    if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
        print_error "Docker Compose is not installed. Please install Docker Compose first."
        exit 1
    fi
    
    print_success "Dependencies check passed"
}

# Setup certificate
setup_certificate() {
    echo ""
    print_info "Certificate Setup"
    echo "=================="
    
    read -p "Do you have a .p12 certificate file? (y/n): " has_cert
    
    if [[ $has_cert =~ ^[Yy]$ ]]; then
        while true; do
            read -p "Enter the full path to your .p12 certificate file: " cert_path
            if [[ -f "$cert_path" ]]; then
                # Check if file is readable
                if [[ -r "$cert_path" ]]; then
                    print_success "Certificate file found and readable"
                    
                    # Set proper permissions
                    chmod 644 "$cert_path"
                    print_info "Set certificate file permissions to 644"
                    
                    # Copy to expected location
                    print_info "Setting up certificate directory (requires sudo password)..."
                    CERT_DIR="/opt/documenso"
                    sudo mkdir -p "$CERT_DIR"
                    sudo cp "$cert_path" "$CERT_DIR/cert.p12"
                    sudo chown 1001:1001 "$CERT_DIR/cert.p12"
                    sudo chmod 644 "$CERT_DIR/cert.p12"
                    
                    print_success "Certificate copied to $CERT_DIR/cert.p12 with proper ownership"
                    break
                else
                    print_error "Certificate file exists but is not readable. Please check permissions."
                fi
            else
                print_error "Certificate file not found at: $cert_path"
                print_info "Please provide a valid path to your .p12 certificate file"
            fi
        done
        
        read -p "Does your certificate have a passphrase? (y/n): " has_passphrase
        if [[ $has_passphrase =~ ^[Yy]$ ]]; then
            read -s -p "Enter certificate passphrase: " cert_passphrase
            echo ""
            export CERT_PASSPHRASE="$cert_passphrase"
        fi
    else
        print_warning "You need a .p12 certificate to sign documents."
        print_info "You can:"
        print_info "1. Generate a self-signed certificate (for testing/internal use)"
        print_info "2. Buy one from a Certificate Authority (for production use)"
        echo ""
        read -p "Would you like to generate a self-signed certificate now? (y/n): " generate_cert
        
        if [[ $generate_cert =~ ^[Yy]$ ]]; then
            generate_self_signed_cert
        else
            print_error "Cannot proceed without a certificate. Please obtain a .p12 file and run this script again."
            exit 1
        fi
    fi
}

# Generate self-signed certificate
generate_self_signed_cert() {
    print_info "Generating self-signed certificate..."
    
    # Collect certificate info
    read -p "Organization Name (e.g., Your Company): " org_name
    read -p "Country Code (2 letters, e.g., US): " country_code
    read -p "State/Province: " state
    read -p "City: " city
    read -p "Email Address: " email
    
    # Create temporary directory
    TEMP_DIR=$(mktemp -d)
    cd "$TEMP_DIR"
    
    # Generate private key
    openssl genrsa -out private.key 2048
    
    # Generate certificate
    openssl req -new -x509 -key private.key -out certificate.crt -days 365 -subj "/C=$country_code/ST=$state/L=$city/O=$org_name/emailAddress=$email"
    
    # Create .p12 file
    read -s -p "Enter a passphrase for the certificate (or press Enter for no passphrase): " cert_passphrase
    echo ""
    
    if [[ -n "$cert_passphrase" ]]; then
        openssl pkcs12 -export -out certificate.p12 -inkey private.key -in certificate.crt -password "pass:$cert_passphrase"
        export CERT_PASSPHRASE="$cert_passphrase"
    else
        openssl pkcs12 -export -out certificate.p12 -inkey private.key -in certificate.crt -password pass:
    fi
    
    # Copy to expected location
    print_info "Installing certificate (requires sudo password)..."
    CERT_DIR="/opt/documenso"
    sudo mkdir -p "$CERT_DIR"
    sudo cp certificate.p12 "$CERT_DIR/cert.p12"
    sudo chown 1001:1001 "$CERT_DIR/cert.p12"
    sudo chmod 644 "$CERT_DIR/cert.p12"
    
    # Cleanup
    cd - > /dev/null
    rm -rf "$TEMP_DIR"
    
    print_success "Self-signed certificate generated and installed"
    print_warning "Note: Self-signed certificates won't show as 'trusted' in PDF readers like Adobe"
}

# Create .env file
create_env_file() {
    echo ""
    print_info "Environment Configuration"
    echo "========================="
    
    if [[ -f ".env" ]]; then
        print_warning ".env file already exists"
        read -p "Do you want to overwrite it? (y/n): " overwrite
        if [[ ! $overwrite =~ ^[Yy]$ ]]; then
            print_info "Keeping existing .env file"
            return
        fi
    fi
    
    # Generate random secrets
    NEXTAUTH_SECRET=$(openssl rand -hex 32)
    ENCRYPTION_KEY=$(openssl rand -hex 32)
    ENCRYPTION_SECONDARY_KEY=$(openssl rand -hex 32)
    
    # Get user input
    read -p "Enter your public URL (e.g., https://documenso.yourcompany.com): " webapp_url
    read -p "Enter your SMTP host: " smtp_host
    read -p "Enter your SMTP port (usually 587): " smtp_port
    read -p "Enter your SMTP username: " smtp_username
    read -s -p "Enter your SMTP password: " smtp_password
    echo ""
    read -p "Enter your SMTP from name (e.g., Your Company): " smtp_from_name
    read -p "Enter your SMTP from address: " smtp_from_address
    
    # Database configuration
    POSTGRES_USER="documenso"
    POSTGRES_PASSWORD=$(openssl rand -hex 16)
    POSTGRES_DB="documenso"
    DATABASE_URL="postgresql://$POSTGRES_USER:$POSTGRES_PASSWORD@database:5432/$POSTGRES_DB"
    
    # Create .env file
    cat > .env << EOF
# Generated by Documenso self-hosting setup script
# $(date)

# Database
POSTGRES_USER=$POSTGRES_USER
POSTGRES_PASSWORD=$POSTGRES_PASSWORD
POSTGRES_DB=$POSTGRES_DB

# Application
PORT=3000
NEXTAUTH_SECRET=$NEXTAUTH_SECRET
NEXT_PRIVATE_ENCRYPTION_KEY=$ENCRYPTION_KEY
NEXT_PRIVATE_ENCRYPTION_SECONDARY_KEY=$ENCRYPTION_SECONDARY_KEY
NEXT_PUBLIC_WEBAPP_URL=$webapp_url
NEXT_PRIVATE_INTERNAL_WEBAPP_URL=http://localhost:3000
NEXT_PRIVATE_DATABASE_URL=$DATABASE_URL
NEXT_PRIVATE_DIRECT_DATABASE_URL=$DATABASE_URL

# SMTP Configuration
NEXT_PRIVATE_SMTP_TRANSPORT=smtp-auth
NEXT_PRIVATE_SMTP_HOST=$smtp_host
NEXT_PRIVATE_SMTP_PORT=$smtp_port
NEXT_PRIVATE_SMTP_USERNAME=$smtp_username
NEXT_PRIVATE_SMTP_PASSWORD=$smtp_password
NEXT_PRIVATE_SMTP_FROM_NAME=$smtp_from_name
NEXT_PRIVATE_SMTP_FROM_ADDRESS=$smtp_from_address

# Certificate Configuration
NEXT_PRIVATE_SIGNING_LOCAL_FILE_PATH=/opt/documenso/cert.p12
EOF

    if [[ -n "${CERT_PASSPHRASE:-}" ]]; then
        echo "NEXT_PRIVATE_SIGNING_PASSPHRASE=$CERT_PASSPHRASE" >> .env
    fi
    
    print_success ".env file created successfully"
}

# Download docker-compose file
download_compose_file() {
    echo ""
    print_info "Docker Compose Setup"
    echo "===================="
    
    if [[ -f "compose.yml" ]]; then
        print_warning "compose.yml already exists"
        read -p "Do you want to download the latest version? (y/n): " download_new
        if [[ ! $download_new =~ ^[Yy]$ ]]; then
            return
        fi
    fi
    
    print_info "Downloading Docker Compose file..."
    curl -o compose.yml https://raw.githubusercontent.com/documenso/documenso/main/docker/production/compose.yml
    print_success "compose.yml downloaded"
}

# Main setup function
main() {
    echo "This script will help you set up Documenso for self-hosting."
    echo "It will:"
    echo "- Check dependencies"
    echo "- Set up your signing certificate"
    echo "- Create environment configuration"
    echo "- Download Docker Compose file"
    echo ""
    read -p "Continue? (y/n): " continue_setup
    
    if [[ ! $continue_setup =~ ^[Yy]$ ]]; then
        print_info "Setup cancelled"
        exit 0
    fi
    
    check_dependencies
    setup_certificate
    create_env_file
    download_compose_file
    
    echo ""
    print_success "Setup completed successfully!"
    echo ""
    print_info "Next steps:"
    echo "1. Review your .env file and make any necessary adjustments"
    echo "2. Start Documenso with: docker-compose up -d"
    echo "3. Access your instance at: $webapp_url"
    echo ""
    print_info "For troubleshooting, check the logs with: docker-compose logs -f"
}

# Run main function
main "$@"