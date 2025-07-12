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
        
        # Certificate password is required
        print_warning "Your certificate MUST have a password to work correctly"
        print_info "Certificates without passwords will cause 'Failed to get private key bags' errors"
        
        while true; do
            read -s -p "Enter your certificate password: " cert_passphrase
            echo ""
            
            if [[ -z "$cert_passphrase" ]]; then
                print_error "Password cannot be empty"
                print_info "If your certificate doesn't have a password, you'll need to:"
                print_info "1. Create a new certificate with a password, OR"
                print_info "2. Re-export your existing certificate with a password"
                echo ""
                read -p "Do you want to generate a new certificate instead? (y/n): " generate_new
                if [[ $generate_new =~ ^[Yy]$ ]]; then
                    generate_self_signed_cert
                    return
                fi
                continue
            fi
            
            export CERT_PASSPHRASE="$cert_passphrase"
            break
        done
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
    print_info "Creating P12 certificate file..."
    print_warning "IMPORTANT: A certificate password is required to prevent signing failures"
    
    # Require password for certificate to prevent "Failed to get private key bags" error
    while true; do
        read -s -p "Enter a password for the certificate (minimum 4 characters): " cert_passphrase
        echo ""
        
        if [[ -z "$cert_passphrase" ]]; then
            print_error "Password is required. Certificates without passwords cause signing failures."
            continue
        fi
        
        if [[ ${#cert_passphrase} -lt 4 ]]; then
            print_error "Password must be at least 4 characters long"
            continue
        fi
        
        read -s -p "Confirm password: " cert_passphrase_confirm
        echo ""
        
        if [[ "$cert_passphrase" != "$cert_passphrase_confirm" ]]; then
            print_error "Passwords do not match"
            continue
        fi
        
        break
    done
    
    openssl pkcs12 -export -out certificate.p12 -inkey private.key -in certificate.crt \
        -password "pass:$cert_passphrase" \
        -keypbe PBE-SHA1-3DES \
        -certpbe PBE-SHA1-3DES \
        -macalg sha1
    
    export CERT_PASSPHRASE="$cert_passphrase"
    print_success "Certificate created with passphrase"
    
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

# Start containers and setup database
start_and_migrate() {
    echo ""
    print_info "Starting Documenso"
    echo "=================="
    
    # Clean up any existing containers/volumes to avoid credential conflicts
    print_info "Cleaning up any existing containers..."
    docker-compose down -v 2>/dev/null || true
    
    # Load environment variables from .env file
    if [[ -f ".env" ]]; then
        source .env
    else
        print_error ".env file not found"
        exit 1
    fi
    
    print_info "Pulling latest Docker images..."
    docker-compose pull
    
    print_info "Starting Docker containers..."
    docker-compose up -d
    
    print_info "Waiting for database to be ready..."
    
    # Wait for database container to be running first
    max_attempts=30
    attempt=0
    
    while [ $attempt -lt $max_attempts ]; do
        if docker-compose ps database | grep -q "Up"; then
            print_info "Database container is running"
            break
        fi
        
        if [ $attempt -eq 0 ]; then
            echo -n "Waiting for database container"
        fi
        echo -n "."
        sleep 2
        attempt=$((attempt + 1))
    done
    echo ""
    
    if [ $attempt -eq $max_attempts ]; then
        print_error "Database container failed to start"
        print_info "Check logs with: docker-compose logs database"
        exit 1
    fi
    
    # Now wait for PostgreSQL to be ready with proper credentials
    print_info "Waiting for PostgreSQL to initialize..."
    max_attempts=60
    attempt=0
    
    while [ $attempt -lt $max_attempts ]; do
        # Use the actual credentials from environment variables
        if docker-compose exec -T database pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB" > /dev/null 2>&1; then
            print_success "Database is ready!"
            break
        fi
        
        if [ $attempt -eq 0 ]; then
            echo -n "Waiting for database initialization"
        fi
        echo -n "."
        sleep 2
        attempt=$((attempt + 1))
    done
    echo ""
    
    if [ $attempt -eq $max_attempts ]; then
        print_error "Database failed to initialize within 120 seconds"
        print_info "Check logs with: docker-compose logs database"
        print_info "This might be due to existing database volumes with different credentials"
        print_info "Try running: docker-compose down -v && docker system prune -f"
        exit 1
    fi
    
    # Test database connection with actual credentials
    print_info "Testing database connection..."
    if docker-compose exec -T database psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "SELECT 1;" > /dev/null 2>&1; then
        print_success "Database connection successful!"
    else
        print_error "Database connection failed"
        print_info "Check logs with: docker-compose logs database"
        exit 1
    fi
    
    print_info "Waiting for application container to be ready..."
    max_attempts=30
    attempt=0
    
    while [ $attempt -lt $max_attempts ]; do
        if docker-compose ps documenso | grep -q "Up"; then
            print_info "Application container is running"
            break
        fi
        
        if [ $attempt -eq 0 ]; then
            echo -n "Waiting for application container"
        fi
        echo -n "."
        sleep 2
        attempt=$((attempt + 1))
    done
    echo ""
    
    if [ $attempt -eq $max_attempts ]; then
        print_error "Application container failed to start"
        print_info "Check logs with: docker-compose logs documenso"
        exit 1
    fi
    
    # Wait a bit more for the application to fully initialize
    print_info "Waiting for application to initialize..."
    sleep 10
    
    print_info "Running database migrations..."
    
    # Run database migration with retry logic
    max_attempts=3
    attempt=0
    
    while [ $attempt -lt $max_attempts ]; do
        if docker-compose exec -T documenso npx prisma migrate deploy --schema=../../packages/prisma/schema.prisma; then
            print_success "Database migration completed successfully!"
            break
        else
            attempt=$((attempt + 1))
            if [ $attempt -lt $max_attempts ]; then
                print_warning "Migration failed, retrying in 10 seconds... (attempt $attempt/$max_attempts)"
                sleep 10
            fi
        fi
    done
    
    if [ $attempt -eq $max_attempts ]; then
        print_error "Database migration failed after $max_attempts attempts"
        print_info "Check logs with: docker-compose logs documenso"
        print_info "Check database logs with: docker-compose logs database"
        print_info "You can try running the migration manually with:"
        print_info "docker-compose exec documenso npx prisma migrate deploy --schema=../../packages/prisma/schema.prisma"
        exit 1
    fi
    
    print_success "Documenso is now running!"
}

# Main setup function
main() {
    echo "This script will help you set up Documenso for self-hosting."
    echo "It will:"
    echo "- Check dependencies"
    echo "- Set up your signing certificate"
    echo "- Create environment configuration"
    echo "- Download Docker Compose file"
    echo "- Start the containers and run database migrations"
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
    start_and_migrate
    
    echo ""
    print_success "🎉 Documenso is now fully set up and running!"
    echo ""
    print_info "You can now:"
    echo "1. Access your Documenso instance at: ${webapp_url:-your-webapp-url}"
    echo "2. Create your first admin account by visiting the web interface"
    echo "3. Start uploading and signing documents!"
    echo ""
    print_info "Useful commands:"
    echo "- View logs: docker-compose logs -f"
    echo "- Stop services: docker-compose down"
    echo "- Restart services: docker-compose restart"
    echo "- Update Documenso: docker-compose pull && docker-compose up -d --force-recreate"
    echo ""
    print_warning "Remember to:"
    echo "- Keep your .env file secure and backed up"
    echo "- Regularly backup your database"
    echo "- Keep your certificate file secure"
}

# Run main function
main "$@"