# Docker Setup for Documenso

The following guide will walk you through setting up Documenso using Docker. The default compose file contains the Documenso app and PostgreSQL DB container.

## Prerequisites

- Docker and Docker Compose installed and enabled on the host system
- A valid SMTP account or API details for a hosted MTA service

## Steps

1. Generate a p12 signing key
2. Configure your .env file
3. Modify your compose.yml file
4. Launch the container stack
5. Access the web app using a browser

### 1. Generate a p12 signing key

> [!NOTE]  
> Due to changes in upstream libraries, it is necessary to append ``-legacy`` when generating the p12 certificate. The below instructions reflect this change.

The follow generates a self-signed ``cert.p12`` file from a generated RSA 2048 key pair. This is is required to validate signatures within the app and will be bind mounted as specified in the compose.yml file:

```bash
openssl genrsa -out private.key 2048
openssl req -new -x509 -key private.key -out certificate.crt -days 365
openssl pkcs12 -export -out certificate.p12 -inkey private.key -in certificate.crt -legacy.
```

### 2. Modify compose.yml

- Copy the ``compose.yml`` file from this repo: [compose.yml](https://raw.githubusercontent.com/documenso/documenso/release/docker/production/compose.yml) into the base directory containing your ``cert.p12``
- Modify the ``compose.yml`` file to reflect your use case. A fairly comprehensive set of environment variables are declared by default. These can be removed as necessary, but the following variables must be declared in your ``compose.yml`` file, with values expressed in the accompanying ``.env`` file:

Under the database service node:
```
POSTGRES_USER
POSTGRES_PASSWORD
POSTGRES_DB
```
Under the documenso service node:
```
PORT
NEXTAUTH_URL
NEXTAUTH_SECRET
NEXT_PRIVATE_ENCRYPTION_KEY
NEXT_PRIVATE_ENCRYPTION_SECONDARY_KEY
NEXT_PRIVATE_SMTP_TRANSPORT
NEXT_PRIVATE_SMTP_HOST
NEXT_PRIVATE_SMTP_PORT
NEXT_PRIVATE_SMTP_USERNAME
NEXT_PRIVATE_SMTP_PASSWORD
NEXT_PRIVATE_SMTP_FROM_NAME
NEXT_PRIVATE_SMTP_FROM_ADDRESS
NEXT_PUBLIC_WEBAPP_URL
NEXT_PUBLIC_MARKETING_URL
NEXT_PRIVATE_DATABASE_URL
NEXT_PRIVATE_DIRECT_DATABASE_URL
```
It is recommended that you leave the values for optional env vars you choose to keep and the required vars as they are in the ``compose.yml`` file and instead modify the values as necessary in the ``.env`` file.

- Ensure that the path to your p12 under the documenso service node is correct.

### 3. Create .env

Create a `.env` file in the same directory as you ``compose.yml`` file.  This file should contain values for all of the environment variables declared in your ``compose.yml`` file.

> [!NOTE]  
> Secrets and keys should be at least 40 characters long and Postgres passwords 16 characters long. You can use Linux's ``pwgen`` tool to generate random strings using the command ``pwgen 40 3 && pwgen 16 1``.

> [!NOTE]  
> Although several popular MTAs are supported, you can use any valid SMTP credentials with Documenso, provided your email provider allows external SMTP connections.

```
POSTGRES_USER=postgres
POSTGRES_PASSWORD=<random-password>
POSTGRES_DB=documenso
NEXTAUTH_SECRET=<your-secret>
NEXT_PRIVATE_ENCRYPTION_KEY=<your-key>
NEXT_PRIVATE_ENCRYPTION_SECONDARY_KEY=<your-secondary-key>
NEXT_PUBLIC_WEBAPP_URL=<your-url>
NEXT_PRIVATE_SMTP_TRANSPORT=smtp-auth
NEXT_PRIVATE_SMTP_HOST=<your-host>
NEXT_PRIVATE_SMTP_PORT=<your-port>
NEXT_PRIVATE_SMTP_USERNAME=<your-username>
NEXT_PRIVATE_SMTP_PASSWORD=<your-password>
NEXT_PRIVATE_SMTP_FROM_NAME=name <name@email>
NEXT_PRIVATE_SMTP_FROM_ADDRESS=
NEXT_PRIVATE_DATABASE_URL=postgres://${POSTGRES_USER}:${POSTGRES_PASSWORD}@database/${POSTGRES_DB}
NEXT_PRIVATE_DIRECT_DATABASE_URL=${NEXT_PRIVATE_DATABASE_URL}
```

### 4. Run the following command to start the containers:

```
docker compose up -d
```

Omit ``-d`` to view the stdout whilst the containers start. This can be useful for debugging.

### 5. Access the application

Access the Documenso application using the value specified in `NEXT_PUBLIC_WEBAPP_URL`, eg. `https://signing.example.com`

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
| `NEXT_PRIVATE_UPLOAD_FORCE_PATH_STYLE`       | Whether to force path-style URLs for the S3 storage transport.                                      |
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
| `NEXT_PRIVATE_SMTP_UNSAFE_IGNORE_TLS`        | If true, then no TLS will be used (even if STARTTLS is supported)                                   |
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
