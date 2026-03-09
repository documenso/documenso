---
name: create-scratch
description: Create a new scratch file in .agents/scratches/ with a unique three-word ID, frontmatter, and formatted title
license: MIT
compatibility: opencode
metadata:
  audience: agents
  workflow: exploration
---

## What I do

I help you create new scratch files in the `.agents/scratches/` directory. Each scratch file gets:

- A unique three-word identifier (e.g., `calm-teal-cloud`)
- Frontmatter with the current date and formatted title
- Content you provide

## How to use

Run the script with a slug and content:

```bash
pnpm exec tsx scripts/create-scratch.ts "note-name" "Scratch content here"
```

Or use heredoc for multi-line content:

```bash
pnpm exec tsx scripts/create-scratch.ts "note-name" << HEREDOC
Multi-line
scratch content
goes here
HEREDOC
```

## File format

Files are created as: `{three-word-id}-{slug}.md`

Example: `calm-teal-cloud-note-name.md`

The file includes frontmatter:

```markdown
---
date: 2026-01-13
title: Note Name
---

Your content here
```

## When to use me

Use this skill when you need to create a temporary note, exploration document, or scratch pad for ideas. The unique ID ensures no filename conflicts, and the frontmatter provides metadata for organization.
