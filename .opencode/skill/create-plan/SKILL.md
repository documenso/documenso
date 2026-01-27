---
name: create-plan
description: Create a new plan file in .agents/plans/ with a unique three-word ID, frontmatter, and formatted title
license: MIT
compatibility: opencode
metadata:
  audience: agents
  workflow: planning
---

## What I do

I help you create new plan files in the `.agents/plans/` directory. Each plan file gets:

- A unique three-word identifier (e.g., `happy-blue-moon`)
- Frontmatter with the current date and formatted title
- Content you provide

## How to use

Run the script with a slug and content:

```bash
npx tsx scripts/create-plan.ts "feature-name" "Plan content here"
```

Or use heredoc for multi-line content:

```bash
npx tsx scripts/create-plan.ts "feature-name" << HEREDOC
Multi-line
plan content
goes here
HEREDOC
```

## File format

Files are created as: `{three-word-id}-{slug}.md`

Example: `happy-blue-moon-feature-name.md`

The file includes frontmatter:

```markdown
---
date: 2026-01-13
title: Feature Name
---

Your content here
```

## When to use me

Use this skill when you need to create a new plan document for a feature, task, or project. The unique ID ensures no filename conflicts, and the frontmatter provides metadata for organization.
