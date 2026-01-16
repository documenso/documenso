---
description: Generate MDX documentation for a module or feature
argument-hint: <module-path-or-feature>
---

You are creating proper MDX documentation for a module or feature in Documenso using Nextra.

## Your Task

1. **Identify the scope** - What does `$ARGUMENTS` refer to? (file, directory, or feature name)
2. **Read the source code** - Understand the public API, types, and behavior
3. **Read existing docs** - Check if there's documentation to update or reference
4. **Write comprehensive documentation** - Create or update MDX docs in the appropriate location
5. **Update navigation** - Add entry to `_meta.js` if creating a new page

## Documentation Structure

Create documentation in the appropriate location:

- **Developer docs**: `apps/documentation/pages/developers/`
- **User docs**: `apps/documentation/pages/users/`

### File Format

All documentation files must be `.mdx` files with frontmatter:

```mdx
---
title: Page Title
description: Brief description for SEO and meta tags
---

# Page Title

Content starts here...
```

### Navigation

Each directory should have a `_meta.js` file that defines the navigation structure:

```javascript
export default {
  index: 'Introduction',
  'feature-name': 'Feature Name',
  'another-feature': 'Another Feature',
};
```

If creating a new page, add it to the appropriate `_meta.js` file.

### Documentation Format

````mdx
---
title: <Module|Feature Name>
description: Brief description of what this does and when to use it
---

# <Module|Feature Name>

Brief description of what this module/feature does and when to use it.

## Installation

If there are specific packages or imports needed:

```bash
npm install @documenso/package-name
```

## Quick Start

```jsx
// Minimal working example
import { Component } from '@documenso/package';

const Example = () => {
  return <Component />;
};
```

## API Reference

### Component/Function Name

Description of what it does.

#### Props/Parameters

| Prop/Param | Type                 | Description               |
| ---------- | -------------------- | ------------------------- |
| prop       | `string`             | Description of the prop   |
| optional   | `boolean` (optional) | Optional prop description |

#### Example

```jsx
import { Component } from '@documenso/package';

<Component prop="value" optional={true} />;
```

### Types

#### `TypeName`

```typescript
type TypeName = {
  property: string;
  optional?: boolean;
};
```

## Examples

### Common Use Case

```jsx
// Full working example
```

### Advanced Usage

```jsx
// More complex example
```

## Related

- [Link to related documentation](/developers/path)
- [Another related page](/users/path)
````

## Guidelines

### Content Quality

- **Be accurate** - Verify behavior by reading the code
- **Be complete** - Document all public API surface
- **Be practical** - Include real, working examples
- **Be concise** - Don't over-explain obvious things
- **Be user-focused** - Write for the target audience (developers or users)

### Code Examples

- Use appropriate language tags: `jsx`, `tsx`, `typescript`, `bash`, `json`
- Show imports when not obvious
- Include expected output in comments where helpful
- Progress from simple to complex
- Use real examples from the codebase when possible

### Formatting

- Always include frontmatter with `title` and `description`
- Use proper markdown headers (h1 for title, h2 for sections)
- Use tables for props/parameters documentation (matching existing style)
- Use code fences with appropriate language tags
- Use Nextra components when appropriate:
  - `<Callout type="info">` for notes
  - `<Steps>` for step-by-step instructions
- Use relative links for internal documentation (e.g., `/developers/embedding/react`)

### Nextra Components

You can import and use Nextra components:

```jsx
import { Callout, Steps } from 'nextra/components';

<Callout type="info">
  This is an informational note.
</Callout>

<Steps>
  <Steps.Step>First step</Steps.Step>
  <Steps.Step>Second step</Steps.Step>
</Steps>
```

### Maintenance

- Include types inline so docs don't get stale
- Reference source file locations for complex behavior
- Keep examples up-to-date with the codebase
- Update `_meta.js` when adding new pages

## Process

1. **Explore the code** - Read source files to understand the API
2. **Identify the audience** - Is this for developers or users?
3. **Check existing docs** - Look for similar pages to match style
4. **Draft the structure** - Outline sections before writing
5. **Write content** - Fill in each section with frontmatter
6. **Add examples** - Create working code samples
7. **Update navigation** - Add to `_meta.js` if needed
8. **Review** - Read through for clarity and accuracy

## Begin

Analyze `$ARGUMENTS`, read the relevant source code, check existing documentation patterns, and create comprehensive MDX documentation following the Documenso documentation style.
