# Documentation Writing Style Guide

This document defines the writing conventions for Documenso documentation.

Documentation lives in `apps/docs/` as MDX files and uses [Fumadocs](https://fumadocs.dev).

## Core Principles

1. **Task-based navigation** - Organize by what users want to do, not by feature hierarchy
2. **Progressive examples** - Start simple, build to complex
3. **Explicit limitations** - List what's NOT supported clearly
4. **Real-world context** - Explain document signing concepts with familiar comparisons

## Tone

- Direct and action-oriented
- Second person ("you") with imperative voice
- Technical but accessible
- Acknowledge complexity without condescension
- No emojis or excessive personality

## Anti-Patterns to Avoid

- Assuming document signing domain knowledge
- Hiding default values
- Separate "TypeScript" sections (types integrated throughout)
- Monolithic single-page references
- Examples that don't work with current API

## Documentation Audiences

The docs serve three distinct audiences:

1. **Users** - People using the Documenso web application to send and sign documents
2. **Developers** - Building integrations with the API or SDKs
3. **Self-hosters** - Running their own Documenso instance

Tailor content to the audience:

- User docs: Focus on UI workflows, no code required
- Developer docs: API/SDK examples, authentication, webhooks
- Self-hosting docs: Deployment, configuration, infrastructure

## File Structure

```
apps/docs/
├── index.mdx              # Landing page with audience navigation
├── getting-started/       # Quick starts for each audience
├── users/                 # Application usage guides
│   ├── documents/         # Creating and managing documents
│   ├── templates/         # Working with templates
│   ├── signing/           # Signing documents
│   └── settings/          # Account and team settings
├── developers/            # API and SDK documentation
│   ├── api/               # REST API reference
│   ├── sdk/               # SDK guides
│   ├── webhooks/          # Webhook integration
│   └── examples/          # Code examples and recipes
├── self-hosting/          # Self-hosting documentation
│   ├── deployment/        # Deployment guides
│   ├── configuration/     # Environment and settings
│   └── maintenance/       # Upgrades and backups
├── concepts/              # Shared concepts across audiences
└── migration/             # Migration guides
```

Each directory has a `meta.json` controlling navigation order:

```json
{
  "title": "Section Title",
  "pages": ["index", "page-one", "page-two"]
}
```

Use `---Label---` for section dividers in `meta.json`.

## MDX Frontmatter

Every page needs frontmatter for search and SEO:

```yaml
---
title: Working with Pages
description: Add, remove, reorder, copy, and merge PDF pages.
---
```

## Page Structure

### User Documentation

```mdx
---
title: Feature Name
description: Brief description for SEO and previews.
---

# Feature Name

Brief description of what this does and when to use it.

## Steps

1. Navigate to **Settings > Feature**
2. Click **Add New**
3. Fill in the required fields

---

## See Also

- [Related Guide](/docs/users/related)
```

### Developer Documentation

```mdx
---
title: Feature Name
description: Brief description for SEO and previews.
---

# Feature Name

Brief description of what this does and when to use it.

## Quick Start

\`\`\`typescript
// Minimal working example
\`\`\`

---

## Section Name

Content organized by task or concept.

---

## See Also

- [Related Guide](/docs/developers/related)
```

### Self-Hosting Documentation

```mdx
---
title: Configuration Topic
description: Brief description for SEO and previews.
---

# Configuration Topic

Brief description of what this configures.

## Environment Variables

| Variable   | Required | Default | Description  |
| ---------- | -------- | ------- | ------------ |
| `VAR_NAME` | Yes      | -       | What it does |

---

## See Also

- [Related Guide](/docs/self-hosting/related)
```

## Parameter Tables

Use Sharp-style nested parameter tables for developer documentation (API/SDK):

```markdown
### methodName(param, options?)

Description of what the method does.

| Param               | Type      | Default  | Description           |
| ------------------- | --------- | -------- | --------------------- |
| `param`             | `string`  | required | What it does          |
| `[options]`         | `Options` |          |                       |
| `[options.setting]` | `boolean` | `false`  | Nested option         |
| `[options.timeout]` | `number`  | `5000`   | Another nested option |

**Returns**: `Promise<Result>`

**Throws**:

- `SpecificError` - When something goes wrong
```

Key conventions:

- Square brackets `[param]` indicate optional parameters
- Nested options indented with `[options.name]` pattern
- Always show default values
- Group related options under their parent

## Code Examples

For developer documentation, use progressive complexity:

```typescript
// Basic usage
const document = await documenso.documents.create({
  title: "Contract",
  file: pdfBuffer,
});

// With recipients
const document = await documenso.documents.create({
  title: "Contract",
  file: pdfBuffer,
  recipients: [{ email: "signer@example.com", name: "John Doe" }],
});

// Full example with error handling
try {
  const document = await documenso.documents.create({
    title: "Contract",
    file: pdfBuffer,
    recipients: [{ email: "signer@example.com", name: "John Doe" }],
  });
} catch (error) {
  if (error instanceof DocumentError) {
    // Handle document creation error
  }
}
```

### Example Guidelines

- All examples must be valid TypeScript
- Show imports when not obvious
- Include expected output in comments where helpful
- Use realistic values, not `foo`/`bar`

## UI Instructions

For user documentation, use clear step-by-step instructions:

- Bold UI elements: **Settings**, **Save**, **Documents**
- Use `>` for navigation paths: **Settings > Team > Members**
- Number sequential steps
- Include screenshots sparingly for complex workflows
- Describe what the user should see after each action

## Callouts

Use Fumadocs callouts sparingly for important information:

```mdx
<Callout type="info">Informational note about behavior.</Callout>

<Callout type="warn">Warning about potential issues or breaking changes.</Callout>

<Callout type="error">Critical warning about data loss or security.</Callout>
```

Reserve callouts for:

- Beta/unstable features
- Security considerations
- Common mistakes
- Breaking changes

## Tables

Use tables for:

- Feature matrices
- Parameter documentation
- Comparison charts
- Error catalogs

```markdown
| Feature          | Status | Notes                    |
| ---------------- | ------ | ------------------------ |
| Email signing    | Full   | All recipient types      |
| Embedded signing | Full   | Via SDK or direct links  |
| Templates        | Full   | Create and use templates |
```

## Linking

- Link to related docs: `[Documents](/docs/api/documents)`
- Use relative paths within docs
- Add "See Also" sections for discoverability

## Error Documentation

Categorize errors by when they occur:

```markdown
## Document Errors

Thrown when creating or updating documents.

### InvalidDocumentError

Document could not be processed.

**Common causes:**

- File is not a valid PDF
- File exceeds size limits

**Solution:** Verify the file is a valid PDF within size limits.
```

## Concept Explanations

Use analogies for document signing concepts:

```markdown
Think of a **signing workflow** like passing a physical document around an office.

Each recipient gets the document in turn, adds their signature or initials,
and passes it to the next person. The **document status** tracks where it
is in this journey.
```

## Self-Hosting Specific

For self-hosting documentation:

- Always specify required vs optional environment variables
- Include example `.env` snippets
- Document Docker and non-Docker approaches where applicable
- Link to troubleshooting for common deployment issues
- Specify minimum system requirements

## Maintenance

- Include types inline so docs don't get stale
- Reference source file locations for complex behavior
- Update examples when API changes
- Test all code examples work
- Keep environment variable documentation in sync with actual defaults
