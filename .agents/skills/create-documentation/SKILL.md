---
name: create-documentation
description: Generate markdown documentation for a module or feature
---

You are creating proper markdown documentation for a feature or guide in the Documenso documentation site.

**Read [WRITING_STYLE.md](../../../WRITING_STYLE.md) first** for tone, formatting conventions, and anti-patterns to avoid.

## Your Task

1. **Identify the scope** - Based on the conversation context, determine what feature or topic needs documentation. Ask the user if unclear.
2. **Identify the audience** - Is this for Users, Developers, or Self-Hosters?
3. **Read the source code** - Understand the feature, API, or configuration being documented.
4. **Read existing docs** - Check `apps/docs/content/docs/` for documentation to update.
5. **Write comprehensive documentation** - Create or update MDX docs following the patterns below.
6. **Update navigation** - Add to the relevant `meta.json` if creating a new page.

## Documentation Framework

This project uses [Fumadocs](https://fumadocs.dev). All documentation lives in `apps/docs/content/docs/` as MDX files. The docs app is a Next.js app at `apps/docs/`.

## Documentation Structure

```
apps/docs/content/docs/
├── index.mdx              # Landing page with audience navigation
├── meta.json              # Root navigation: guides + resources
├── users/                 # Application usage guides
│   ├── meta.json          # { "root": true, "pages": [...] }
│   ├── getting-started/   # Account creation, first document
│   ├── documents/         # Upload, recipients, fields, send
│   │   └── advanced/      # AI detection, visibility, placeholders
│   ├── templates/         # Create and use templates
│   ├── organisations/     # Overview, members, groups, SSO, billing
│   │   ├── single-sign-on/
│   │   └── preferences/
│   └── settings/          # Profile, security, API tokens
├── developers/            # API and integration docs
│   ├── meta.json          # { "root": true, "pages": [...] }
│   ├── getting-started/   # Authentication, first API call
│   ├── api/               # Documents, recipients, fields, templates, teams
│   ├── webhooks/          # Setup, events, verification
│   ├── embedding/         # Authoring, direct links, CSS vars, SDKs
│   │   └── sdks/          # React, Vue, Svelte, Solid, Preact, Angular
│   ├── examples/          # Common workflows
│   ├── local-development/ # Quickstart, manual, translations
│   └── contributing/      # Contributing translations
├── self-hosting/          # Self-hosting documentation
│   ├── meta.json          # { "root": true, "pages": [...] }
│   ├── getting-started/   # Quick start, requirements, tips
│   ├── deployment/        # Docker, docker-compose, Kubernetes, Railway
│   ├── configuration/     # Environment, database, email, storage
│   │   ├── signing-certificate/  # Local, Google Cloud HSM, timestamp
│   │   └── advanced/      # OAuth providers, AI features
│   └── maintenance/       # Upgrades, backups, troubleshooting
├── concepts/              # Shared across audiences
│   └── ...                # Document lifecycle, field types, signing
├── compliance/            # eSign, GDPR, standards, certifications
└── policies/              # Terms, privacy, security, licenses
```

### Where to Put Documentation

| Type                | Location                                         | When to use                                        |
| ------------------- | ------------------------------------------------ | -------------------------------------------------- |
| **User Guide**      | `apps/docs/content/docs/users/<section>/`        | UI workflows for using the Documenso web app       |
| **Developer Guide** | `apps/docs/content/docs/developers/<section>/`   | API reference, SDK guides, webhooks, embedding     |
| **Self-Hosting**    | `apps/docs/content/docs/self-hosting/<section>/` | Deployment, configuration, environment variables   |
| **Concept**         | `apps/docs/content/docs/concepts/`               | Cross-audience concepts (document lifecycle, etc.) |
| **Compliance**      | `apps/docs/content/docs/compliance/`             | Legal and regulatory documentation                 |

### Navigation (meta.json)

Each directory has a `meta.json` controlling navigation order:

```json
{
  "title": "Section Title",
  "pages": ["getting-started", "documents", "templates"]
}
```

Top-level audience sections use `"root": true`:

```json
{
  "title": "Users",
  "description": "Send and sign documents",
  "root": true,
  "pages": ["getting-started", "documents", "templates", "organisations", "settings"]
}
```

Root `meta.json` uses `---Label---` for section dividers:

```json
{
  "title": "Documentation",
  "pages": [
    "---Guides---",
    "users",
    "developers",
    "self-hosting",
    "---Resources---",
    "concepts",
    "compliance",
    "policies"
  ]
}
```

## MDX File Format

### Frontmatter

Every page needs frontmatter:

```yaml
---
title: Upload Documents
description: Upload documents to Documenso to prepare them for signing. Covers supported formats, file size limits, and upload methods.
---
```

### Fumadocs Components

Import components at the top of the file (after frontmatter):

```mdx
import { Accordion, Accordions } from 'fumadocs-ui/components/accordion';
import { Callout } from 'fumadocs-ui/components/callout';
import { Step, Steps } from 'fumadocs-ui/components/steps';
import { Tab, Tabs } from 'fumadocs-ui/components/tabs';

;
```

Callouts (use sparingly for warnings, beta features, security):

```mdx
<Callout type="info">Informational note about behavior.</Callout>

<Callout type="warn">Warning about potential issues or breaking changes.</Callout>

<Callout type="error">Critical warning about data loss or security.</Callout>
```

Steps (for sequential UI instructions):

```mdx
{/* prettier-ignore */}
<Steps>
  <Step>
    ### Step title

    Step description.

  </Step>
  <Step>
    ### Next step

    Next description.

  </Step>
</Steps>
```

Tabs (for multiple approaches or platforms):

````mdx
<Tabs items={['cURL', 'JavaScript', 'Python']}>
  <Tab value="cURL">```bash curl -X POST ... ```</Tab>
  <Tab value="JavaScript">```typescript const response = await fetch(...) ```</Tab>
</Tabs>
````

## Page Structure by Audience

### User Documentation

```mdx
---
title: Feature Name
description: Brief description for SEO and previews.
---

import { Callout } from 'fumadocs-ui/components/callout';
import { Step, Steps } from 'fumadocs-ui/components/steps';

## Limitations

| Limitation        | Value    |
| ----------------- | -------- |
| Supported format  | PDF only |
| Maximum file size | 50MB     |

## How to Do the Thing

{/* prettier-ignore */}
<Steps>
  <Step>
    ### Navigate to the page

    Open **Settings > Feature**.

  </Step>
  <Step>
    ### Configure the setting

    Fill in the required fields and click **Save**.

  </Step>
</Steps>

---

## See Also

- [Related Guide](/docs/users/related)
```

### Developer Documentation

````mdx
---
title: Documents API
description: Create, manage, and send documents for signing via the API.
---

import { Callout } from 'fumadocs-ui/components/callout';
import { Tab, Tabs } from 'fumadocs-ui/components/tabs';

<Callout type="warn">
  This guide may not reflect the latest endpoints. For an always up-to-date reference, see the
  [OpenAPI Reference](https://openapi.documenso.com).
</Callout>

## Overview

Brief description of the resource and what you can do with it.

## Resource Object

| Property | Type   | Description       |
| -------- | ------ | ----------------- |
| `id`     | string | Unique identifier |
| `status` | string | Current status    |

## Create a Resource

```typescript
const response = await fetch('https://app.documenso.com/api/v2/document', {
  method: 'POST',
  headers: {
    Authorization: 'Bearer YOUR_API_TOKEN',
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    title: 'Service Agreement',
  }),
});
```
````

---

## See Also

- [Related Guide](/docs/developers/related)

````

### Self-Hosting Documentation

```mdx
---
title: Environment Variables
description: Complete reference for all environment variables used to configure Documenso.
---

## Required Variables

| Variable           | Description                                      |
| ------------------ | ------------------------------------------------ |
| `NEXTAUTH_SECRET`  | Secret key for session encryption (min 32 chars)  |
| `DATABASE_URL`     | PostgreSQL connection URL                        |

---

## Optional Variables

| Variable       | Default | Description            |
| -------------- | ------- | ---------------------- |
| `PORT`         | `3000`  | Port the server runs on |

---

## See Also

- [Database Configuration](/docs/self-hosting/configuration/database)
````

## Documentation Audiences

Tailor content to the audience:

- **User docs**: Focus on UI workflows, bold UI elements (**Settings**, **Save**), use `>` for navigation paths (**Settings > Team > Members**), number sequential steps, no code required
- **Developer docs**: API/SDK examples, authentication, webhooks, code samples in TypeScript, link to OpenAPI reference
- **Self-hosting docs**: Deployment guides, environment variables, Docker/non-Docker approaches, system requirements, troubleshooting

## Guidelines

See [WRITING_STYLE.md](../../../WRITING_STYLE.md) for complete guidelines. Key points:

- **Tone**: Direct, second-person, no emojis, no excessive personality
- **Examples**: Progressive complexity, all must be valid TypeScript
- **Tables**: Use Sharp-style nested parameter tables for API docs
- **Callouts**: Use sparingly for warnings, beta features, security
- **Cross-references**: Link related docs, add "See Also" sections
- **Navigation**: Update `meta.json` when adding new pages
- **Limitations**: Explicitly list what is NOT supported
- **Images**: Use `.webp` format, store in `apps/docs/public/`

## Process

1. **Identify the audience** - Users, Developers, or Self-Hosters?
2. **Explore the code** - Read source files to understand the feature
3. **Check existing docs** - Look in `apps/docs/content/docs/` for related pages
4. **Draft the structure** - Outline sections before writing
5. **Write content** - Fill in each section following audience-specific patterns
6. **Update navigation** - Add to relevant `meta.json` if creating a new page
7. **Add cross-references** - Link from related docs, add "See Also" section

## Begin

Analyze the conversation context to determine the documentation scope, read the relevant source code, and create comprehensive MDX documentation in `apps/docs/content/docs/`.
