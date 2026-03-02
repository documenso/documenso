---
description: Create a new plan file in .agents/plans/
argument-hint: <plan-slug> [content]
---

You are creating a new plan file in the `.agents/plans/` directory.

## Your Task

1. **Determine the slug** - Use `$ARGUMENTS` as the file slug (kebab-case recommended)
2. **Gather content** - Collect or generate the plan content
3. **Create the file** - Use the create-plan script to generate the file

## Usage

The script will automatically:

- Generate a unique three-word ID (e.g., `happy-blue-moon`)
- Create frontmatter with current date and formatted title
- Save the file as `{id}-{slug}.md` in `.agents/plans/`

## Creating the File

### Option 1: Direct Content

If you have the content ready, run:

```bash
pnpm exec tsx scripts/create-plan.ts "$ARGUMENTS" "Your plan content here"
```

### Option 2: Multi-line Content (Heredoc)

For multi-line content, use heredoc:

```bash
pnpm exec tsx scripts/create-plan.ts "$ARGUMENTS" << HEREDOC
Your multi-line
plan content
goes here
HEREDOC
```

### Option 3: Pipe Content

You can also pipe content:

```bash
echo "Your content" | pnpm exec tsx scripts/create-plan.ts "$ARGUMENTS"
```

## File Format

The created file will have:

```markdown
---
date: 2026-01-13
title: Plan Title
---

Your content here
```

The title is automatically formatted from the slug (e.g., `my-feature` → `My Feature`).

## Guidelines

- Use descriptive slugs in kebab-case (e.g., `user-authentication`, `api-integration`)
- Include clear, actionable plan content
- The unique ID ensures no filename conflicts
- Files are automatically dated for organization

## Begin

Create a plan file using the slug from `$ARGUMENTS` and appropriate content for the planning task.
