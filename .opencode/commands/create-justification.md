---
description: Create a new justification file in .agents/justifications/
argument-hint: <justification-slug> [content]
---

You are creating a new justification file in the `.agents/justifications/` directory.

## Your Task

1. **Determine the slug** - Use `$ARGUMENTS` as the file slug (kebab-case recommended)
2. **Gather content** - Collect or generate the justification content
3. **Create the file** - Use the create-justification script to generate the file

## Usage

The script will automatically:
- Generate a unique three-word ID (e.g., `swift-emerald-river`)
- Create frontmatter with current date and formatted title
- Save the file as `{id}-{slug}.md` in `.agents/justifications/`

## Creating the File

### Option 1: Direct Content

If you have the content ready, run:

```bash
npx tsx scripts/create-justification.ts "$ARGUMENTS" "Your justification content here"
```

### Option 2: Multi-line Content (Heredoc)

For multi-line content, use heredoc:

```bash
npx tsx scripts/create-justification.ts "$ARGUMENTS" << HEREDOC
Your multi-line
justification content
goes here
HEREDOC
```

### Option 3: Pipe Content

You can also pipe content:

```bash
echo "Your content" | npx tsx scripts/create-justification.ts "$ARGUMENTS"
```

## File Format

The created file will have:

```markdown
---
date: 2026-01-13
title: Justification Title
---

Your content here
```

The title is automatically formatted from the slug (e.g., `architecture-decision` → `Architecture Decision`).

## Guidelines

- Use descriptive slugs in kebab-case (e.g., `tech-stack-choice`, `api-design-rationale`)
- Include clear reasoning and context for the decision
- The unique ID ensures no filename conflicts
- Files are automatically dated for organization

## Begin

Create a justification file using the slug from `$ARGUMENTS` and appropriate content documenting the reasoning or justification.
