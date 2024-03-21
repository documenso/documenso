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
NEXTAUTH_SECRET="<your-secret>"
NEXT_PRIVATE_ENCRYPTION_KEY="<your-key>"
NEXT_PRIVATE_ENCRYPTION_SECONDARY_KEY="<your-secondary-key>"
NEXT_PUBLIC_WEBAPP_URL="<your-url>"
NEXT_PRIVATE_SMTP_TRANSPORT="smtp-auth"
NEXT_PRIVATE_SMTP_HOST="<your-host>"
NEXT_PRIVATE_SMTP_PORT=<your-port>
NEXT_PRIVATE_SMTP_USERNAME="<your-username>"
NEXT_PRIVATE_SMTP_PASSWORD="<your-password>"
```

4. Update the volume binding for the cert file in the `compose.yml` file to point to your own key file:

Since the `cert.p12` file is required for signing and encrypting documents, you will need to provide your own key file. Update the volume binding in the `compose.yml` file to point to your key file:

```yaml
volumes:
  - /path/to/your/keyfile.p12:/opt/documenso/cert.p12
```

1. Run the following command to start the containers:

```
docker-compose --env-file ./.env -d up
```

This will start the PostgreSQL database and the Documenso application containers.

5. Access the Documenso application by visiting `http://localhost:3000` in your web browser.

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
  -e NEXTAUTH_URL="<your-nextauth-url>"
  -e NEXTAUTH_SECRET="<your-nextauth-secret>"
  -e NEXT_PRIVATE_ENCRYPTION_KEY="<your-next-private-encryption-key>"
  -e NEXT_PRIVATE_ENCRYPTION_SECONDARY_KEY="<your-next-private-encryption-secondary-key>"
  -e NEXT_PUBLIC_WEBAPP_URL="<your-next-public-webapp-url>"
  -e NEXT_PRIVATE_DATABASE_URL="<your-next-private-database-url>"
  -e NEXT_PRIVATE_DIRECT_DATABASE_URL="<your-next-private-database-url>"
  -e NEXT_PRIVATE_SMTP_TRANSPORT="<your-next-private-smtp-transport>"
  -e NEXT_PRIVATE_SMTP_FROM_NAME="<your-next-private-smtp-from-name>"
  -e NEXT_PRIVATE_SMTP_FROM_ADDRESS="<your-next-private-smtp-from-address>"
  -v /path/to/your/keyfile.p12:/opt/documenso/cert.p12
  documenso/documenso
```

Replace the placeholders with your actual database and SMTP details.

1. Access the Documenso application by visiting the URL you provided in the `NEXT_PUBLIC_WEBAPP_URL` environment variable in your web browser.

## Success

You have now successfully set up Documenso using Docker. You can start organizing and managing your documents efficiently. If you encounter any issues or have further questions, please refer to the official Documenso documentation or seek assistance from the community.

## Advanced Configuration

The environment variables listed above are a subset of those that are available for configuring Documenso. For a complete list of environment variables and their descriptions, refer to the table below:

Here's a markdown table documenting all the provided environment variables:

| Variable                                     | Description                                                                                         |
| -------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `PORT`                                       | The port to run the Documenso application on, defaults to `3000`.                                   |
| `NEXTAUTH_URL`                               | The URL for the NextAuth.js authentication service.                                                 |
| `NEXTAUTH_SECRET`                            | The secret key used by NextAuth.js for encryption and signing.                                      |
| `NEXT_PRIVATE_ENCRYPTION_KEY`                | The primary encryption key for symmetric encryption and decryption (at least 32 characters).        |
| `NEXT_PRIVATE_ENCRYPTION_SECONDARY_KEY`      | The secondary encryption key for symmetric encryption and decryption (at least 32 characters).      |
| `NEXT_PRIVATE_GOOGLE_CLIENT_ID`              | The Google client ID for Google authentication (optional).                                          |
| `NEXT_PRIVATE_GOOGLE_CLIENT_SECRET`          | The Google client secret for Google authentication (optional).                                      |
| `NEXT_PUBLIC_WEBAPP_URL`                     | The URL for the web application.                                                                    |
| `NEXT_PRIVATE_DATABASE_URL`                  | The URL for the primary database connection (with connection pooling).                              |
| `NEXT_PRIVATE_DIRECT_DATABASE_URL`           | The URL for the direct database connection (without connection pooling).                            |
| `NEXT_PRIVATE_SIGNING_TRANSPORT`             | The signing transport to use. Available options: local (default)                                    |
| `NEXT_PRIVATE_SIGNING_PASSPHRASE`            | The passphrase for the key file.                                                                    |
| `NEXT_PRIVATE_SIGNING_LOCAL_FILE_CONTENTS`   | The base64-encoded contents of the key file, will be used instead of file path.                     |
| `NEXT_PRIVATE_SIGNING_LOCAL_FILE_PATH`       | The path to the key file, default `/opt/documenso/cert.p12`.                                        |
| `NEXT_PUBLIC_UPLOAD_TRANSPORT`               | The transport to use for file uploads (database or s3).                                             |
| `NEXT_PRIVATE_UPLOAD_ENDPOINT`               | The endpoint for the S3 storage transport (for third-party S3-compatible providers).                |
| `NEXT_PRIVATE_UPLOAD_REGION`                 | The region for the S3 storage transport (defaults to us-east-1).                                    |
| `NEXT_PRIVATE_UPLOAD_BUCKET`                 | The bucket to use for the S3 storage transport.                                                     |
| `NEXT_PRIVATE_UPLOAD_ACCESS_KEY_ID`          | The access key ID for the S3 storage transport.                                                     |
| `NEXT_PRIVATE_UPLOAD_SECRET_ACCESS_KEY`      | The secret access key for the S3 storage transport.                                                 |
| `NEXT_PRIVATE_SMTP_TRANSPORT`                | The transport to use for sending emails (smtp-auth, smtp-api, resend, or mailchannels).             |
| `NEXT_PRIVATE_SMTP_HOST`                     | The host for the SMTP server for SMTP transports.                                                   |
| `NEXT_PRIVATE_SMTP_PORT`                     | The port for the SMTP server for SMTP transports.                                                   |
| `NEXT_PRIVATE_SMTP_USERNAME`                 | The username for the SMTP server for the `smtp-auth` transport.                                     |
| `NEXT_PRIVATE_SMTP_PASSWORD`                 | The password for the SMTP server for the `smtp-auth` transport.                                     |
| `NEXT_PRIVATE_SMTP_APIKEY_USER`              | The API key user for the SMTP server for the `smtp-api` transport.                                  |
| `NEXT_PRIVATE_SMTP_APIKEY`                   | The API key for the SMTP server for the `smtp-api` transport.                                       |
| `NEXT_PRIVATE_SMTP_SECURE`                   | Whether to force the use of TLS for the SMTP server for SMTP transports.                            |
| `NEXT_PRIVATE_SMTP_FROM_ADDRESS`             | The email address for the "from" address.                                                           |
| `NEXT_PRIVATE_SMTP_FROM_NAME`                | The sender name for the "from" address.                                                             |
| `NEXT_PRIVATE_RESEND_API_KEY`                | The API key for Resend.com for the `resend` transport.                                              |
| `NEXT_PRIVATE_MAILCHANNELS_API_KEY`          | The optional API key for MailChannels (if using a proxy) for the `mailchannels` transport.          |
| `NEXT_PRIVATE_MAILCHANNELS_ENDPOINT`         | The optional endpoint for the MailChannels API (if using a proxy) for the `mailchannels` transport. |
| `NEXT_PRIVATE_MAILCHANNELS_DKIM_DOMAIN`      | The domain for DKIM signing with MailChannels for the `mailchannels` transport.                     |
| `NEXT_PRIVATE_MAILCHANNELS_DKIM_SELECTOR`    | The selector for DKIM signing with MailChannels for the `mailchannels` transport.                   |
| `NEXT_PRIVATE_MAILCHANNELS_DKIM_PRIVATE_KEY` | The private key for DKIM signing with MailChannels for the `mailchannels` transport.                |
| `NEXT_PUBLIC_DOCUMENT_SIZE_UPLOAD_LIMIT`     | The maximum document upload limit displayed to the user (in MB).                                    |
| `NEXT_PUBLIC_POSTHOG_KEY`                    | The optional PostHog key for analytics and feature flags.                                           |
| `NEXT_PUBLIC_DISABLE_SIGNUP`                 | Whether to disable user signups through the /signup page.                                           |
