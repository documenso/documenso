# Documenso Helm Chart

This Helm chart deploys Documenso, a document signing platform, and its required PostgreSQL database on Kubernetes.

## Prerequisites

- Kubernetes 1.16+
- Helm 3.1+
- PV provisioner support in the underlying infrastructure (if persistence is required)

## Installation

1. Update the `values.yaml` file to configure your deployment
2. Install the chart:

```bash
helm install documenso ./helm-chart
```

## Configuration

The following table lists the configurable parameters of the Documenso chart and their default values.

### Global Parameters

| Parameter | Description | Default |
|-----------|-------------|---------|
| `global.nameOverride` | Override the name of the chart | `""` |
| `global.fullnameOverride` | Override the full name of the chart | `""` |

### Documenso Application Parameters

| Parameter | Description | Default |
|-----------|-------------|---------|
| `documenso.replicaCount` | Number of Documenso replicas to deploy | `1` |
| `documenso.image.repository` | Documenso image repository | `documenso/documenso` |
| `documenso.image.tag` | Documenso image tag | `latest` |
| `documenso.image.pullPolicy` | Documenso image pull policy | `IfNotPresent` |
| `documenso.service.type` | Kubernetes Service type | `ClusterIP` |
| `documenso.service.port` | Kubernetes Service port | `3000` |
| `documenso.resources` | CPU/Memory resource requests/limits | `{}` |
| `documenso.env.*` | Non-sensitive environment variables | See `values.yaml` |
| `documenso.secret.*` | Sensitive environment variables | See `values.yaml` |
| `documenso.certificate.enabled` | Enable certificate mounting | `true` |
| `documenso.certificate.mountPath` | Path to mount the certificate | `/opt/documenso/cert.p12` |
| `documenso.certificate.existingSecret` | Name of existing secret with certificate | `""` |
| `documenso.certificate.key` | Key in the secret that contains the certificate | `cert.p12` |

### PostgreSQL Parameters

| Parameter | Description | Default |
|-----------|-------------|---------|
| `postgresql.enabled` | Deploy PostgreSQL server | `true` |
| `postgresql.image.repository` | PostgreSQL image repository | `postgres` |
| `postgresql.image.tag` | PostgreSQL image tag | `15` |
| `postgresql.service.port` | PostgreSQL service port | `5432` |
| `postgresql.persistence.enabled` | Enable PostgreSQL persistence using PVC | `true` |
| `postgresql.persistence.size` | PostgreSQL Persistent Volume size | `10Gi` |
| `postgresql.persistence.storageClass` | PostgreSQL PVC Storage Class | `""` |
| `postgresql.auth.username` | PostgreSQL username | `postgres` |
| `postgresql.auth.password` | PostgreSQL password | `""` |
| `postgresql.auth.database` | PostgreSQL database name | `documenso` |

## Required Configuration

At minimum, you must provide values for these parameters:

```yaml
documenso:
  secret:
    NEXTAUTH_SECRET: "your-auth-secret"
    NEXT_PRIVATE_ENCRYPTION_KEY: "your-encryption-key"
    NEXT_PRIVATE_ENCRYPTION_SECONDARY_KEY: "your-secondary-encryption-key"
    NEXT_PRIVATE_SMTP_TRANSPORT: "smtp-transport"
    NEXT_PRIVATE_SMTP_FROM_NAME: "Documenso"
    NEXT_PRIVATE_SMTP_FROM_ADDRESS: "no-reply@example.com"
  env:
    NEXT_PUBLIC_WEBAPP_URL: "https://your-documenso-instance.example.com"

postgresql:
  auth:
    password: "your-secure-password"
```

## Certificate Configuration

To use document signing functionality, you need to provide a PKCS#12 certificate.

If you have an existing certificate, create a secret and reference it:

```yaml
documenso:
  certificate:
    existingSecret: "my-certificate-secret"
```

## External Database

If you want to use an external database, disable the included PostgreSQL and provide connection details:

```yaml
postgresql:
  enabled: false

documenso:
  secret:
    NEXT_PRIVATE_DATABASE_URL: "postgres://username:password@external-postgres:5432/database"
    NEXT_PRIVATE_DIRECT_DATABASE_URL: "postgres://username:password@external-postgres:5432/database"
```
