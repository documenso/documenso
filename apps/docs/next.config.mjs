import { createMDX } from 'fumadocs-mdx/next';

const withMDX = createMDX();

/** @type {import('next').NextConfig} */
const config = {
  reactStrictMode: true,
  async rewrites() {
    return [
      {
        source: '/docs/:path*.mdx',
        destination: '/llms.mdx/docs/:path*',
      },
    ];
  },
  async redirects() {
    return [
      // ============================================================
      // Legacy docs site redirects (old site had no /docs prefix)
      // ============================================================

      // Root
      { source: '/users', destination: '/docs/users', permanent: true },
      { source: '/developers', destination: '/docs/developers', permanent: true },

      // --- Users: Getting Started ---
      {
        source: '/users/get-started/account-creation',
        destination: '/docs/users/getting-started/create-account',
        permanent: true,
      },
      {
        source: '/users/get-started/account-security',
        destination: '/docs/users/settings/security',
        permanent: true,
      },

      // --- Users: Profile & Settings ---
      { source: '/users/profile', destination: '/docs/users/settings/profile', permanent: true },
      { source: '/users/support', destination: '/docs/policies/support', permanent: true },

      // --- Users: Organisations ---
      { source: '/users/organisations', destination: '/docs/users/organisations', permanent: true },
      {
        source: '/users/organisations/members',
        destination: '/docs/users/organisations/members',
        permanent: true,
      },
      {
        source: '/users/organisations/groups',
        destination: '/docs/users/organisations/groups',
        permanent: true,
      },
      {
        source: '/users/organisations/teams',
        destination: '/docs/users/organisations/overview',
        permanent: true,
      },
      {
        source: '/users/organisations/billing',
        destination: '/docs/users/organisations/billing',
        permanent: true,
      },
      {
        source: '/users/organisations/sso',
        destination: '/docs/users/organisations/single-sign-on',
        permanent: true,
      },
      {
        source: '/users/organisations/sso/microsoft-entra-id',
        destination: '/docs/users/organisations/single-sign-on/microsoft-entra-id',
        permanent: true,
      },

      // --- Users: Documents ---
      {
        source: '/users/documents/sending-documents',
        destination: '/docs/users/documents',
        permanent: true,
      },
      {
        source: '/users/documents/document-preferences',
        destination: '/docs/users/organisations/preferences/document',
        permanent: true,
      },
      {
        source: '/users/documents/document-visibility',
        destination: '/docs/users/documents/advanced/document-visibility',
        permanent: true,
      },
      {
        source: '/users/documents/fields',
        destination: '/docs/users/documents/add-fields',
        permanent: true,
      },
      {
        source: '/users/documents/pdf-placeholders',
        destination: '/docs/users/documents/advanced/pdf-placeholders',
        permanent: true,
      },
      {
        source: '/users/documents/email-preferences',
        destination: '/docs/users/organisations/preferences/email',
        permanent: true,
      },
      {
        source: '/users/documents/ai-detection',
        destination: '/docs/users/documents/advanced/ai-detection',
        permanent: true,
      },
      {
        source: '/users/documents/default-recipients',
        destination: '/docs/users/documents/advanced/default-recipients',
        permanent: true,
      },

      // --- Users: Templates, Branding, etc. ---
      { source: '/users/templates', destination: '/docs/users/templates', permanent: true },
      {
        source: '/users/branding',
        destination: '/docs/users/organisations/preferences/branding',
        permanent: true,
      },
      {
        source: '/users/email-domains',
        destination: '/docs/users/organisations/email-domains',
        permanent: true,
      },
      {
        source: '/users/direct-links',
        destination: '/docs/users/documents/direct-links',
        permanent: true,
      },
      { source: '/users/fair-use', destination: '/docs/policies/fair-use', permanent: true },

      // --- Users: Licenses ---
      { source: '/users/licenses', destination: '/docs/policies/licenses', permanent: true },
      {
        source: '/users/licenses/community-edition',
        destination: '/docs/policies/community-edition',
        permanent: true,
      },
      {
        source: '/users/licenses/enterprise-edition',
        destination: '/docs/policies/enterprise-edition',
        permanent: true,
      },

      // --- Users: Compliance ---
      {
        source: '/users/compliance/signature-levels',
        destination: '/docs/compliance/signature-levels',
        permanent: true,
      },
      {
        source: '/users/compliance/standards-and-regulations',
        destination: '/docs/compliance/standards',
        permanent: true,
      },

      // --- Developers: Local Development ---
      {
        source: '/developers/local-development',
        destination: '/docs/developers/local-development',
        permanent: true,
      },
      {
        source: '/developers/local-development/quickstart',
        destination: '/docs/developers/local-development/quickstart',
        permanent: true,
      },
      {
        source: '/developers/local-development/manual',
        destination: '/docs/developers/local-development/manual',
        permanent: true,
      },
      {
        source: '/developers/local-development/gitpod',
        destination: '/docs/developers/local-development/gitpod',
        permanent: true,
      },
      {
        source: '/developers/local-development/signing-certificate',
        destination: '/docs/developers/local-development/signing-certificate',
        permanent: true,
      },
      {
        source: '/developers/local-development/translations',
        destination: '/docs/developers/local-development/translations',
        permanent: true,
      },

      // --- Developers: Self-Hosting (moved to top-level section) ---
      { source: '/developers/self-hosting', destination: '/docs/self-hosting', permanent: true },
      {
        source: '/developers/self-hosting/signing-certificate',
        destination: '/docs/self-hosting/configuration/signing-certificate',
        permanent: true,
      },
      {
        source: '/developers/self-hosting/how-to',
        destination: '/docs/self-hosting/getting-started/quick-start',
        permanent: true,
      },
      {
        source: '/developers/self-hosting/setting-up-oauth-providers',
        destination: '/docs/self-hosting/configuration/advanced/oauth-providers',
        permanent: true,
      },
      {
        source: '/developers/self-hosting/telemetry',
        destination: '/docs/self-hosting/configuration/telemetry',
        permanent: true,
      },
      {
        source: '/developers/self-hosting/ai-features',
        destination: '/docs/self-hosting/configuration/advanced/ai-features',
        permanent: true,
      },

      // --- Developers: Contributing ---
      {
        source: '/developers/contributing',
        destination: '/docs/developers/contributing',
        permanent: true,
      },
      {
        source: '/developers/contributing/contributing-translations',
        destination: '/docs/developers/contributing/contributing-translations',
        permanent: true,
      },

      // --- Developers: Public API (restructured) ---
      { source: '/developers/public-api', destination: '/docs/developers/api', permanent: true },
      {
        source: '/developers/public-api/authentication',
        destination: '/docs/developers/getting-started/authentication',
        permanent: true,
      },
      {
        source: '/developers/public-api/rate-limits',
        destination: '/docs/developers/api/rate-limits',
        permanent: true,
      },
      {
        source: '/developers/public-api/versioning',
        destination: '/docs/developers/api/versioning',
        permanent: true,
      },
      {
        source: '/developers/public-api/reference',
        destination: '/docs/developers/api',
        permanent: true,
      },

      // --- Developers: Embedding ---
      {
        source: '/developers/embedding',
        destination: '/docs/developers/embedding',
        permanent: true,
      },
      {
        source: '/developers/embedding/react',
        destination: '/docs/developers/embedding/sdks/react',
        permanent: true,
      },
      {
        source: '/developers/embedding/vue',
        destination: '/docs/developers/embedding/sdks/vue',
        permanent: true,
      },
      {
        source: '/developers/embedding/svelte',
        destination: '/docs/developers/embedding/sdks/svelte',
        permanent: true,
      },
      {
        source: '/developers/embedding/solid',
        destination: '/docs/developers/embedding/sdks/solid',
        permanent: true,
      },
      {
        source: '/developers/embedding/preact',
        destination: '/docs/developers/embedding/sdks/preact',
        permanent: true,
      },
      {
        source: '/developers/embedding/angular',
        destination: '/docs/developers/embedding/sdks/angular',
        permanent: true,
      },
      {
        source: '/developers/embedding/css-variables',
        destination: '/docs/developers/embedding/css-variables',
        permanent: true,
      },
      {
        source: '/developers/embedding/authoring',
        destination: '/docs/developers/embedding/authoring',
        permanent: true,
      },
      {
        source: '/developers/embedded-authoring',
        destination: '/docs/developers/embedding/authoring',
        permanent: true,
      },

      // --- Developers: Webhooks & Developer Mode ---
      { source: '/developers/webhooks', destination: '/docs/developers/webhooks', permanent: true },
      {
        source: '/developers/developer-mode/field-coordinates',
        destination: '/docs/developers/api/developer-mode',
        permanent: true,
      },

      // --- Self-Hosting (old paths without /docs prefix) ---
      { source: '/self-hosting', destination: '/docs/self-hosting', permanent: true },
      {
        source: '/self-hosting/getting-started',
        destination: '/docs/self-hosting/getting-started',
        permanent: true,
      },
      {
        source: '/self-hosting/getting-started/requirements',
        destination: '/docs/self-hosting/getting-started/requirements',
        permanent: true,
      },
      {
        source: '/self-hosting/getting-started/quick-start',
        destination: '/docs/self-hosting/getting-started/quick-start',
        permanent: true,
      },
      {
        source: '/self-hosting/getting-started/tips',
        destination: '/docs/self-hosting/getting-started/tips',
        permanent: true,
      },
      {
        source: '/self-hosting/deployment',
        destination: '/docs/self-hosting/deployment',
        permanent: true,
      },
      {
        source: '/self-hosting/deployment/docker',
        destination: '/docs/self-hosting/deployment/docker',
        permanent: true,
      },
      {
        source: '/self-hosting/deployment/docker-compose',
        destination: '/docs/self-hosting/deployment/docker-compose',
        permanent: true,
      },
      {
        source: '/self-hosting/deployment/railway',
        destination: '/docs/self-hosting/deployment/railway',
        permanent: true,
      },
      {
        source: '/self-hosting/deployment/kubernetes',
        destination: '/docs/self-hosting/deployment/kubernetes',
        permanent: true,
      },
      {
        source: '/self-hosting/deployment/manual',
        destination: '/docs/self-hosting/deployment/manual',
        permanent: true,
      },
      {
        source: '/self-hosting/configuration',
        destination: '/docs/self-hosting/configuration',
        permanent: true,
      },
      {
        source: '/self-hosting/configuration/environment',
        destination: '/docs/self-hosting/configuration/environment',
        permanent: true,
      },
      {
        source: '/self-hosting/configuration/database',
        destination: '/docs/self-hosting/configuration/database',
        permanent: true,
      },
      {
        source: '/self-hosting/configuration/email',
        destination: '/docs/self-hosting/configuration/email',
        permanent: true,
      },
      {
        source: '/self-hosting/configuration/storage',
        destination: '/docs/self-hosting/configuration/storage',
        permanent: true,
      },
      {
        source: '/self-hosting/configuration/telemetry',
        destination: '/docs/self-hosting/configuration/telemetry',
        permanent: true,
      },
      {
        source: '/self-hosting/configuration/signing-certificate',
        destination: '/docs/self-hosting/configuration/signing-certificate',
        permanent: true,
      },
      {
        source: '/self-hosting/configuration/signing-certificate/local',
        destination: '/docs/self-hosting/configuration/signing-certificate/local',
        permanent: true,
      },
      {
        source: '/self-hosting/configuration/signing-certificate/google-cloud-hsm',
        destination: '/docs/self-hosting/configuration/signing-certificate/google-cloud-hsm',
        permanent: true,
      },
      {
        source: '/self-hosting/configuration/signing-certificate/timestamp-server',
        destination: '/docs/self-hosting/configuration/signing-certificate/timestamp-server',
        permanent: true,
      },
      {
        source: '/self-hosting/configuration/signing-certificate/troubleshooting',
        destination: '/docs/self-hosting/configuration/signing-certificate/troubleshooting',
        permanent: true,
      },
      {
        source: '/self-hosting/configuration/advanced',
        destination: '/docs/self-hosting/configuration/advanced',
        permanent: true,
      },
      {
        source: '/self-hosting/configuration/advanced/oauth-providers',
        destination: '/docs/self-hosting/configuration/advanced/oauth-providers',
        permanent: true,
      },
      {
        source: '/self-hosting/configuration/advanced/ai-features',
        destination: '/docs/self-hosting/configuration/advanced/ai-features',
        permanent: true,
      },
      {
        source: '/self-hosting/maintenance',
        destination: '/docs/self-hosting/maintenance',
        permanent: true,
      },
      {
        source: '/self-hosting/maintenance/upgrades',
        destination: '/docs/self-hosting/maintenance/upgrades',
        permanent: true,
      },
      {
        source: '/self-hosting/maintenance/backups',
        destination: '/docs/self-hosting/maintenance/backups',
        permanent: true,
      },
      {
        source: '/self-hosting/maintenance/troubleshooting',
        destination: '/docs/self-hosting/maintenance/troubleshooting',
        permanent: true,
      },
    ];
  },
};

export default withMDX(config);
