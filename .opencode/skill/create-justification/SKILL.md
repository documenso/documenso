---
name: create-justification
description: Create a new justification file in .agents/justifications/ with a unique three-word ID, frontmatter, and formatted title
license: MIT
compatibility: opencode
metadata:
  audience: agents
  workflow: decision-making
---

## What I do

I help you create new justification files in the `.agents/justifications/` directory. Each justification file gets:

- A unique three-word identifier (e.g., `swift-emerald-river`)
- Frontmatter with the current date and formatted title
- Content you provide

## How to use

Run the script with a slug and content:

```bash
pnpm exec tsx scripts/create-justification.ts "decision-name" "Justification content here"
```

Or use heredoc for multi-line content:

```bash
pnpm exec tsx scripts/create-justification.ts "decision-name" << HEREDOC
Multi-line
justification content
goes here
HEREDOC
```

## File format

Files are created as: `{three-word-id}-{slug}.md`

Example: `swift-emerald-river-decision-name.md`

The file includes frontmatter:

```markdown
---
date: 2026-01-13
title: Decision Name
---

Your content here
```

## When to use me

Use this skill when you need to document the reasoning or justification for a decision, approach, or architectural choice. The unique ID ensures no filename conflicts, and the frontmatter provides metadata for organization.
