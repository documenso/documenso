# Docker Setup for Documenso

The following guide will walk you through setting up Documenso using Docker. You can choose between a production setup using Docker Compose or a standalone container.

## Prerequisites

Before you begin, ensure that you have the following installed:

- Docker
- Docker Compose (if using the Docker Compose setup)

## Option 1: Production Docker Compose Setup

This setup includes a PostgreSQL database and the Documenso application. You will need to provide your own SMTP details via environment variables.

1. Download the Docker Compose file from the Documenso repository: [compose.yml](https://raw.githubusercontent.com/documenso/documenso/release/docker/production/compose.yml)
2. Navigate to the directory containing the `compose.yml` file.
3. Create a `.env` file in the same directory and add your SMTP details as well as a few extra environment variables, following the example below:

```
# Generate random secrets (you can use: openssl rand -hex 32)
NEXTAUTH_SECRET="<your-secret>"
NEXT_PRIVATE_ENCRYPTION_KEY="<your-key>"
NEXT_PRIVATE_ENCRYPTION_SECONDARY_KEY="<your-secondary-key>"

# Your application URL
NEXT_PUBLIC_WEBAPP_URL="<your-url>"

# SMTP Configuration
NEXT_PRIVATE_SMTP_TRANSPORT="smtp-auth"
NEXT_PRIVATE_SMTP_HOST="<your-host>"
NEXT_PRIVATE_SMTP_PORT=<your-port>
NEXT_PRIVATE_SMTP_USERNAME="<your-username>"
NEXT_PRIVATE_SMTP_PASSWORD="<your-password>"
NEXT_PRIVATE_SMTP_FROM_NAME="<your-from-name>"
NEXT_PRIVATE_SMTP_FROM_ADDRESS="<your-from-email>"

# Certificate passphrase (required)
NEXT_PRIVATE_SIGNING_PASSPHRASE="<your-certificate-password>"
```

4. Set up your signing certificate. You have three options:

   **Option A: Generate Certificate Inside Container (Recommended)**

   Start your containers first, then generate a self-signed certificate:

   ```bash
   # Start containers
   docker-compose up -d

   # Set certificate password securely (won't appear in command history)
   read -s -p "Enter certificate password: " CERT_PASS
   echo

   # Generate certificate inside container using environment variable
   docker exec -e CERT_PASS="$CERT_PASS" -it documenso-production-documenso-1 bash -c "
     openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
       -keyout /tmp/private.key \
       -out /tmp/certificate.crt \
       -subj '/C=US/ST=State/L=City/O=Organization/CN=localhost' && \
     openssl pkcs12 -export -out /app/certs/cert.p12 \
       -inkey /tmp/private.key -in /tmp/certificate.crt \
       -passout env:CERT_PASS && \
     rm /tmp/private.key /tmp/certificate.crt
   "

   # Restart container
   docker-compose restart documenso
   ```

   **Option B: Use Existing Certificate**

   If you have an existing `.p12` certificate, update the volume binding in `compose.yml`:

   ```yaml
   volumes:
     - /path/to/your/cert.p12:/opt/documenso/cert.p12:ro
   ```

5. Run the following command to start the containers:

```
docker-compose --env-file ./.env up -d
```

This will start the PostgreSQL database and the Documenso application containers.

6. Access the Documenso application by visiting `http://localhost:3000` in your web browser.

## Option 2: Standalone Docker Container

If you prefer to host the Documenso application on your container provider of choice, you can use the pre-built Docker image from DockerHub or GitHub's Package Registry. Note that you will need to provide your own database and SMTP host.

1. Pull the Documenso Docker image:

```
docker pull documenso/documenso
```

Or, if using GitHub's Package Registry:

```
docker pull ghcr.io/documenso/documenso
```

2. Run the Docker container, providing the necessary environment variables for your database and SMTP host:

```
docker run -d \
  -p 3000:3000 \
  -e NEXTAUTH_SECRET="<your-nextauth-secret>" \
  -e NEXT_PRIVATE_ENCRYPTION_KEY="<your-next-private-encryption-key>" \
  -e NEXT_PRIVATE_ENCRYPTION_SECONDARY_KEY="<your-next-private-encryption-secondary-key>" \
  -e NEXT_PUBLIC_WEBAPP_URL="<your-next-public-webapp-url>" \
  -e NEXT_PRIVATE_INTERNAL_WEBAPP_URL="http://localhost:3000" \
  -e NEXT_PRIVATE_DATABASE_URL="<your-next-private-database-url>" \
  -e NEXT_PRIVATE_DIRECT_DATABASE_URL="<your-next-private-database-url>" \
  -e NEXT_PRIVATE_SMTP_TRANSPORT="<your-next-private-smtp-transport>" \
  -e NEXT_PRIVATE_SMTP_FROM_NAME="<your-next-private-smtp-from-name>" \
  -e NEXT_PRIVATE_SMTP_FROM_ADDRESS="<your-next-private-smtp-from-address>" \
  -e NEXT_PRIVATE_SIGNING_PASSPHRASE="<your-certificate-password>" \
  -v /path/to/your/cert.p12:/opt/documenso/cert.p12:ro \
  documenso/documenso
```

Replace the placeholders with your actual database and SMTP details.

3. Access the Documenso application by visiting the URL you provided in the `NEXT_PUBLIC_WEBAPP_URL` environment variable in your web browser.

## Success

You have now successfully set up Documenso using Docker. You can start organizing and managing your documents efficiently.

## Troubleshooting

### Certificate Permission Issues

If you encounter errors related to certificate access, here are common solutions:

#### Error: "Failed to read signing certificate"

1. **Check file exists:**

   ```bash
   ls -la /path/to/your/cert.p12
   ```

2. **Fix permissions:**

   ```bash
   chmod 644 /path/to/your/cert.p12
   chown 1001:1001 /path/to/your/cert.p12
   ```

3. **Verify Docker mount:**
   ```bash
   docker exec -it <container_name> ls -la /opt/documenso/cert.p12
   ```

### Container Logs

Check application logs for detailed error information:

```bash
# For Docker Compose
docker-compose logs -f documenso

# For standalone container
docker logs -f <container_name>
```

### Health Checks

Check the status of your Documenso instance:

```bash
# Basic health check (database + certificate)
curl http://localhost:3000/api/health

# Detailed certificate status
curl http://localhost:3000/api/certificate-status
```

The health endpoint will show:

- `status: "ok"` - Everything working properly
- `status: "warning"` - App running but certificate issues
- `status: "error"` - Critical issues (database down, etc.)

### Common Issues

1. **Port already in use:** Change the port mapping in compose.yml or your docker run command
2. **Database connection issues:** Ensure your database is running and accessible
3. **SMTP errors:** Verify your email server settings in the .env file

If you encounter any issues or have further questions, please refer to the official Documenso documentation or seek assistance from the community.

## Advanced Configuration

The environment variables listed above are a subset of those that are available for configuring Documenso. For a complete list of environment variables and their descriptions, refer to the table below:

Here's a markdown table documenting all the provided environment variables:

| Variable                                                       | Description                                                                                         |
| -------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `PORT`                                                         | The port to run the Documenso application on, defaults to `3000`.                                   |
| `NEXTAUTH_SECRET`                                              | The secret key used by NextAuth.js for encryption and signing.                                      |
| `NEXT_PRIVATE_ENCRYPTION_KEY`                                  | The primary encryption key for symmetric encryption and decryption (at least 32 characters).        |
| `NEXT_PRIVATE_ENCRYPTION_SECONDARY_KEY`                        | The secondary encryption key for symmetric encryption and decryption (at least 32 characters).      |
| `NEXT_PRIVATE_GOOGLE_CLIENT_ID`                                | The Google client ID for Google authentication (optional).                                          |
| `NEXT_PRIVATE_GOOGLE_CLIENT_SECRET`                            | The Google client secret for Google authentication (optional).                                      |
| `NEXT_PUBLIC_WEBAPP_URL`                                       | The URL for the web application.                                                                    |
| `NEXT_PRIVATE_DATABASE_URL`                                    | The URL for the primary database connection (with connection pooling).                              |
| `NEXT_PRIVATE_DIRECT_DATABASE_URL`                             | The URL for the direct database connection (without connection pooling).                            |
| `NEXT_PRIVATE_SIGNING_TRANSPORT`                               | The signing transport to use. Available options: local (default), gcloud-hsm                        |
| `NEXT_PRIVATE_SIGNING_PASSPHRASE`                              | The passphrase for the key file.                                                                    |
| `NEXT_PRIVATE_SIGNING_LOCAL_FILE_CONTENTS`                     | The base64-encoded contents of the key file, will be used instead of file path.                     |
| `NEXT_PRIVATE_SIGNING_LOCAL_FILE_PATH`                         | The path to the key file, default `/opt/documenso/cert.p12`.                                        |
| `NEXT_PRIVATE_SIGNING_GCLOUD_HSM_KEY_PATH`                     | The Google Cloud HSM key path for the gcloud-hsm signing transport.                                 |
| `NEXT_PRIVATE_SIGNING_GCLOUD_HSM_PUBLIC_CRT_FILE_PATH`         | The path to the Google Cloud HSM public certificate file for the gcloud-hsm transport.              |
| `NEXT_PRIVATE_SIGNING_GCLOUD_HSM_PUBLIC_CRT_FILE_CONTENTS`     | The base64-encoded Google Cloud HSM public certificate for the gcloud-hsm transport.                |
| `NEXT_PRIVATE_SIGNING_GCLOUD_APPLICATION_CREDENTIALS_CONTENTS` | The base64-encoded Google Cloud Credentials for the gcloud-hsm transport.                           |
| `NEXT_PRIVATE_SIGNING_GCLOUD_HSM_CERT_CHAIN_FILE_PATH`         | The path to the certificate chain file for the gcloud-hsm transport.                                |
| `NEXT_PRIVATE_SIGNING_GCLOUD_HSM_CERT_CHAIN_CONTENTS`          | The base64-encoded certificate chain for the gcloud-hsm transport.                                  |
| `NEXT_PRIVATE_SIGNING_GCLOUD_HSM_SECRET_MANAGER_CERT_PATH`     | The Google Secret Manager path to retrieve the certificate for the gcloud-hsm transport.            |
| `NEXT_PRIVATE_SIGNING_TIMESTAMP_AUTHORITY`                     | Comma-separated list of timestamp authority URLs for PDF signing (enables LTV).                     |
| `NEXT_PUBLIC_SIGNING_CONTACT_INFO`                             | Contact info to embed in PDF signatures. Defaults to the webapp URL.                                |
| `NEXT_PRIVATE_USE_LEGACY_SIGNING_SUBFILTER`                    | Set to "true" to use legacy adbe.pkcs7.detached subfilter instead of ETSI.CAdES.detached.           |
| `NEXT_PUBLIC_UPLOAD_TRANSPORT`                                 | The transport to use for file uploads (database or s3).                                             |
| `NEXT_PRIVATE_UPLOAD_ENDPOINT`                                 | The endpoint for the S3 storage transport (for third-party S3-compatible providers).                |
| `NEXT_PRIVATE_UPLOAD_FORCE_PATH_STYLE`                         | Whether to force path-style URLs for the S3 storage transport.                                      |
| `NEXT_PRIVATE_UPLOAD_REGION`                                   | The region for the S3 storage transport (defaults to us-east-1).                                    |
| `NEXT_PRIVATE_UPLOAD_BUCKET`                                   | The bucket to use for the S3 storage transport.                                                     |
| `NEXT_PRIVATE_UPLOAD_ACCESS_KEY_ID`                            | The access key ID for the S3 storage transport.                                                     |
| `NEXT_PRIVATE_UPLOAD_SECRET_ACCESS_KEY`                        | The secret access key for the S3 storage transport.                                                 |
| `NEXT_PRIVATE_SMTP_TRANSPORT`                                  | The transport to use for sending emails (smtp-auth, smtp-api, resend, or mailchannels).             |
| `NEXT_PRIVATE_SMTP_HOST`                                       | The host for the SMTP server for SMTP transports.                                                   |
| `NEXT_PRIVATE_SMTP_PORT`                                       | The port for the SMTP server for SMTP transports.                                                   |
| `NEXT_PRIVATE_SMTP_USERNAME`                                   | The username for the SMTP server for the `smtp-auth` transport.                                     |
| `NEXT_PRIVATE_SMTP_PASSWORD`                                   | The password for the SMTP server for the `smtp-auth` transport.                                     |
| `NEXT_PRIVATE_SMTP_APIKEY_USER`                                | The API key user for the SMTP server for the `smtp-api` transport.                                  |
| `NEXT_PRIVATE_SMTP_APIKEY`                                     | The API key for the SMTP server for the `smtp-api` transport.                                       |
| `NEXT_PRIVATE_SMTP_SECURE`                                     | Whether to force the use of TLS for the SMTP server for SMTP transports.                            |
| `NEXT_PRIVATE_SMTP_UNSAFE_IGNORE_TLS`                          | If true, then no TLS will be used (even if STARTTLS is supported)                                   |
| `NEXT_PRIVATE_SMTP_FROM_ADDRESS`                               | The email address for the "from" address.                                                           |
| `NEXT_PRIVATE_SMTP_FROM_NAME`                                  | The sender name for the "from" address.                                                             |
| `NEXT_PRIVATE_RESEND_API_KEY`                                  | The API key for Resend.com for the `resend` transport.                                              |
| `NEXT_PRIVATE_MAILCHANNELS_API_KEY`                            | The optional API key for MailChannels (if using a proxy) for the `mailchannels` transport.          |
| `NEXT_PRIVATE_MAILCHANNELS_ENDPOINT`                           | The optional endpoint for the MailChannels API (if using a proxy) for the `mailchannels` transport. |
| `NEXT_PRIVATE_MAILCHANNELS_DKIM_DOMAIN`                        | The domain for DKIM signing with MailChannels for the `mailchannels` transport.                     |
| `NEXT_PRIVATE_MAILCHANNELS_DKIM_SELECTOR`                      | The selector for DKIM signing with MailChannels for the `mailchannels` transport.                   |
| `NEXT_PRIVATE_MAILCHANNELS_DKIM_PRIVATE_KEY`                   | The private key for DKIM signing with MailChannels for the `mailchannels` transport.                |
| `NEXT_PUBLIC_DOCUMENT_SIZE_UPLOAD_LIMIT`                       | The maximum document upload limit displayed to the user (in MB).                                    |
| `NEXT_PUBLIC_POSTHOG_KEY`                                      | The optional PostHog key for analytics and feature flags.                                           |
| `NEXT_PUBLIC_DISABLE_SIGNUP`                                   | Whether to disable user signups through the /signup page.                                           |
