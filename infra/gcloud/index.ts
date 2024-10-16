import * as gcp from '@pulumi/gcp';
import * as pulumi from '@pulumi/pulumi';
import * as random from '@pulumi/random';

const config = new pulumi.Config();

// Storage Config
const storageLocation = config.get('storage--location') || 'EU';
const serviceLocation = config.get('service--location') || 'europe-west3';

// KMS Config
const algorithm = config.get('kms--algorithm') || 'RSA_SIGN_PKCS1_4096_SHA256';

// Database Config
const databasePassword = config.get('db--password') || 'password';

// App Config
// App Config
const appUrl = config.require('app--url');
const nextAuthSecret =
  config.getSecret('app--nextauth-secret') ||
  new random.RandomString('next-auth-secret', {
    length: 32,
  }).result;
const encryptionKey =
  config.getSecret('app--encryption-key') ||
  new random.RandomString('encryption-key', {
    length: 32,
  }).result;
const encryptionSecondaryKey =
  config.getSecret('app--encryption-secondary-key') ||
  new random.RandomString('encryption-secondary-key', {
    length: 32,
  }).result;
const googleClientId = config.get('app--google-client-id') || '';
const googleClientSecret = config.get('app--google-client-secret') || '';
const oidcWellKnown = config.get('app--oidc-well-known') || '';
const oidcClientId = config.get('app--oidc-client-id') || '';
const oidcClientSecret = config.get('app--oidc-client-secret') || '';
const oidcProviderLabel = config.get('app--oidc-provider-label') || 'OIDC';
const oidcAllowSignup = config.get('app--oidc-allow-signup') || '';
const oidcSkipVerify = config.get('app--oidc-skip-verify') || '';
const internalWebappUrl = config.get('app--internal-webapp-url') || '';
const smtpTransport = config.get('app--smtp-transport') || 'smtp-auth';
const smtpHost = config.get('app--smtp-host') || '';
const smtpPort = config.get('app--smtp-port') || '';
const smtpUsername = config.get('app--smtp-username') || '';
const smtpPassword = config.getSecret('app--smtp-password') || '';
const smtpApikeyUser = config.get('app--smtp-apikey-user') || '';
const smtpApikey = config.getSecret('app--smtp-apikey') || '';
const smtpSecure = config.get('app--smtp-secure') || '';
const smtpUnsafeIgnoreTls = config.get('app--smtp-unsafe-ignore-tls') || '';
const smtpFromName = config.require('app--smtp-from-name');
const smtpFromAddress = config.require('app--smtp-from-address');
const resendApiKey = config.getSecret('app--resend-api-key') || '';
const documentSizeUploadLimit = config.get('app--document-size-upload-limit') || '50';
const stripeApiKey = config.getSecret('app--stripe-api-key') || '';
const stripeWebhookSecret = config.getSecret('app--stripe-webhook-secret') || '';
const stripeEnterprisePlanMonthlyPriceId =
  config.get('app--stripe-enterprise-plan-monthly-price-id') || '';
const jobsProvider = config.get('app--jobs-provider') || 'local';
const triggerApiKey = config.get('app--trigger-api-key') || '';
const triggerApiUrl = config.get('app--trigger-api-url') || '';
const inngestEventKey = config.get('app--inngest-event-key') || '';
const posthogKey = config.get('app--posthog-key') || '';
const billingEnabled = config.get('app--billing-enabled') || 'false';

new gcp.projects.Service('cloud-kms-api', {
  project: gcp.config.project,
  service: 'cloudkms.googleapis.com',
  disableOnDestroy: false,
});

new gcp.projects.Service('cloud-run-api', {
  project: gcp.config.project,
  service: 'run.googleapis.com',
  disableOnDestroy: false,
});

new gcp.projects.Service('compute-api', {
  project: gcp.config.project,
  service: 'compute.googleapis.com',
  disableOnDestroy: false,
});

const signupDisabled = config.get('app--signup-disabled') || 'false';

// Create a GCS bucket for storage
const storageBucket = new gcp.storage.Bucket('documenso-storage', {
  name: 'documenso-storage',
  location: storageLocation,
});

// Create a service account so we can create a HMAC key to use the S3-compatible storage
// API
const storageServiceAccount = new gcp.serviceaccount.Account('documenso-storage-sa', {
  accountId: 'documenso-storage-sa',
  displayName: 'Storage Service Account',
});

const appServiceAccount = new gcp.serviceaccount.Account('documenso-app-sa', {
  accountId: 'documenso-app-sa',
  displayName: 'App Service Account',
});

// Create the HMAC key for the storage service account
const hmacKey = new gcp.storage.HmacKey('documenso-storage-key', {
  serviceAccountEmail: storageServiceAccount.email,
});

// Create a Cloud HSM cluster
const hsmCluster = new gcp.kms.KeyRing('hsm-keyring', {
  name: 'documenso-hsm-keyring',
  location: serviceLocation,
});

const hsmKey = new gcp.kms.CryptoKey('hsm-key', {
  name: 'documenso-hsm-key',
  keyRing: hsmCluster.id,
  purpose: 'ASYMMETRIC_SIGN',
  versionTemplate: {
    algorithm,
    protectionLevel: 'HSM',
  },
});

// Create the database
const database = new gcp.sql.DatabaseInstance('documenso-db', {
  name: 'documenso-db',
  databaseVersion: 'POSTGRES_15',
  region: serviceLocation,
  settings: {
    tier: 'db-custom-2-4096',
    diskSize: 50,
    diskType: 'PD_SSD',
    diskAutoresize: true,
    ipConfiguration: {
      ipv4Enabled: true,
    },
    backupConfiguration: {
      enabled: true,
      startTime: '02:00',
      backupRetentionSettings: {
        retainedBackups: 30,
      },
      pointInTimeRecoveryEnabled: true,
      transactionLogRetentionDays: 7,
    },
    databaseFlags: [
      { name: 'max_connections', value: '100' },
      { name: 'log_min_duration_statement', value: '300' },
    ],
    maintenanceWindow: {
      day: 7,
      hour: 3,
    },
    insightsConfig: {
      queryInsightsEnabled: true,
      queryStringLength: 1024,
      recordApplicationTags: true,
      recordClientAddress: true,
    },
  },
  deletionProtection: true,
});

const user = new gcp.sql.User('documenso-db-user', {
  name: 'documenso',
  instance: database.name,
  password: databasePassword,
});

// Build and deploy the containerized application using Cloud Run
const appService = new gcp.cloudrun.Service('documenso-app', {
  name: 'documenso-app',
  location: serviceLocation,
  template: {
    metadata: {
      annotations: {
        'run.googleapis.com/cloudsql-instances': database.connectionName,
      },
    },
    spec: {
      containers: [
        {
          image: 'documenso/documenso:latest',
          resources: {
            limits: {
              memory: '4Gi',
              cpu: '4',
            },
          },
          ports: [{ containerPort: 3000 }],
          envs: [
            {
              name: 'NEXTAUTH_URL',
              value: appUrl,
            },
            {
              name: 'NEXTAUTH_SECRET',
              value: nextAuthSecret,
            },
            {
              name: 'NEXT_PRIVATE_ENCRYPTION_KEY',
              value: encryptionKey,
            },
            {
              name: 'NEXT_PRIVATE_ENCRYPTION_SECONDARY_KEY',
              value: encryptionSecondaryKey,
            },
            {
              name: 'NEXT_PRIVATE_GOOGLE_CLIENT_ID',
              value: googleClientId,
            },
            {
              name: 'NEXT_PRIVATE_GOOGLE_CLIENT_SECRET',
              value: googleClientSecret,
            },
            {
              name: 'NEXT_PRIVATE_OIDC_WELL_KNOWN',
              value: oidcWellKnown,
            },
            {
              name: 'NEXT_PRIVATE_OIDC_CLIENT_ID',
              value: oidcClientId,
            },
            {
              name: 'NEXT_PRIVATE_OIDC_CLIENT_SECRET',
              value: oidcClientSecret,
            },
            {
              name: 'NEXT_PRIVATE_OIDC_PROVIDER_LABEL',
              value: oidcProviderLabel,
            },
            {
              name: 'NEXT_PRIVATE_OIDC_ALLOW_SIGNUP',
              value: oidcAllowSignup,
            },
            {
              name: 'NEXT_PRIVATE_OIDC_SKIP_VERIFY',
              value: oidcSkipVerify,
            },
            {
              name: 'NEXT_PUBLIC_WEBAPP_URL',
              value: appUrl,
            },
            {
              name: 'NEXT_PRIVATE_INTERNAL_WEBAPP_URL',
              value: internalWebappUrl,
            },
            {
              name: 'NEXT_PRIVATE_DATABASE_URL',
              value: pulumi.interpolate`postgres://${user.name}:${user.password}@localhost:5432/documenso?host=/cloudsql/${database.connectionName}/`,
            },
            {
              name: 'NEXT_PRIVATE_DIRECT_DATABASE_URL',
              value: pulumi.interpolate`postgres://${user.name}:${user.password}@localhost:5432/documenso?host=/cloudsql/${database.connectionName}/`,
            },
            {
              name: 'NEXT_PRIVATE_SIGNING_TRANSPORT',
              value: 'gcloud-hsm',
            },
            {
              name: 'NEXT_PRIVATE_SIGNING_GCLOUD_HSM_KEY_PATH',
              value: hsmKey.id,
            },
            {
              name: 'NEXT_PUBLIC_UPLOAD_TRANSPORT',
              value: 's3',
            },
            {
              name: 'NEXT_PRIVATE_UPLOAD_ENDPOINT',
              value: 'https://storage.googleapis.com',
            },
            {
              name: 'NEXT_PRIVATE_UPLOAD_FORCE_PATH_STYLE',
              value: 'true',
            },
            {
              name: 'NEXT_PRIVATE_UPLOAD_REGION',
              value: 'auto',
            },
            {
              name: 'NEXT_PRIVATE_UPLOAD_BUCKET',
              value: storageBucket.name,
            },
            {
              name: 'NEXT_PRIVATE_UPLOAD_ACCESS_KEY_ID',
              value: hmacKey.accessId,
            },
            {
              name: 'NEXT_PRIVATE_UPLOAD_SECRET_ACCESS_KEY',
              value: hmacKey.secret,
            },
            {
              name: 'NEXT_PRIVATE_SMTP_TRANSPORT',
              value: smtpTransport,
            },
            {
              name: 'NEXT_PRIVATE_SMTP_HOST',
              value: smtpHost,
            },
            {
              name: 'NEXT_PRIVATE_SMTP_PORT',
              value: smtpPort,
            },
            {
              name: 'NEXT_PRIVATE_SMTP_USERNAME',
              value: smtpUsername,
            },
            {
              name: 'NEXT_PRIVATE_SMTP_PASSWORD',
              value: smtpPassword,
            },
            {
              name: 'NEXT_PRIVATE_SMTP_APIKEY_USER',
              value: smtpApikeyUser,
            },
            {
              name: 'NEXT_PRIVATE_SMTP_APIKEY',
              value: smtpApikey,
            },
            {
              name: 'NEXT_PRIVATE_SMTP_SECURE',
              value: smtpSecure,
            },
            {
              name: 'NEXT_PRIVATE_SMTP_UNSAFE_IGNORE_TLS',
              value: smtpUnsafeIgnoreTls,
            },
            {
              name: 'NEXT_PRIVATE_SMTP_FROM_NAME',
              value: smtpFromName,
            },
            {
              name: 'NEXT_PRIVATE_SMTP_FROM_ADDRESS',
              value: smtpFromAddress,
            },
            {
              name: 'NEXT_PRIVATE_RESEND_API_KEY',
              value: resendApiKey,
            },
            {
              name: 'NEXT_PUBLIC_DOCUMENT_SIZE_UPLOAD_LIMIT',
              value: documentSizeUploadLimit,
            },
            {
              name: 'NEXT_PRIVATE_STRIPE_API_KEY',
              value: stripeApiKey,
            },
            {
              name: 'NEXT_PRIVATE_STRIPE_WEBHOOK_SECRET',
              value: stripeWebhookSecret,
            },
            {
              name: 'NEXT_PUBLIC_STRIPE_ENTERPRISE_PLAN_MONTHLY_PRICE_ID',
              value: stripeEnterprisePlanMonthlyPriceId,
            },
            {
              name: 'NEXT_PRIVATE_JOBS_PROVIDER',
              value: jobsProvider,
            },
            {
              name: 'NEXT_PRIVATE_TRIGGER_API_KEY',
              value: triggerApiKey,
            },
            {
              name: 'NEXT_PRIVATE_TRIGGER_API_URL',
              value: triggerApiUrl,
            },
            {
              name: 'NEXT_PRIVATE_INNGEST_EVENT_KEY',
              value: inngestEventKey,
            },
            {
              name: 'NEXT_PUBLIC_POSTHOG_KEY',
              value: posthogKey,
            },
            {
              name: 'NEXT_PUBLIC_FEATURE_BILLING_ENABLED',
              value: billingEnabled,
            },
            {
              name: 'NEXT_PUBLIC_DISABLE_SIGNUP',
              value: signupDisabled,
            },
          ],
        },
      ],
      timeoutSeconds: 3600,
      serviceAccountName: appServiceAccount.email,
    },
  },
});

// Allow unauthenticated invocations
const iam = new gcp.cloudrun.IamMember('documenso-app-invoker', {
  service: appService.name,
  location: appService.location,
  role: 'roles/run.invoker',
  member: 'allUsers',
});

// Allow the Cloud Run service to use the HSM for signing
const _cryptoKeyIAMBinding = new gcp.kms.CryptoKeyIAMBinding('cryptoKeyIAMBinding', {
  cryptoKeyId: hsmKey.id,
  role: 'roles/cloudkms.signerVerifier',
  members: [appServiceAccount.email.apply((email) => `serviceAccount:${email}`)],
});

// Allow the Cloud Run service to access the GCS Bucket
const _bucketIAMBinding = new gcp.storage.BucketIAMBinding('bucketIAMBinding', {
  bucket: storageBucket.name,
  role: 'roles/storage.objectAdmin',
  members: [appServiceAccount.email.apply((email) => `serviceAccount:${email}`)],
});

export const serviceUrl = appService.statuses[0].url;
