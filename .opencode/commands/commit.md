---
description: Add and commit changes using conventional commits
allowed-tools: Bash, Read, Glob, Grep
---

Create a git commit for the current changes using the Conventional Commits standard.

## Process

1. **Analyze the changes** by running:
   - `git status` to see all modified/untracked files
   - `git diff` to see unstaged changes
   - `git diff --staged` to see already-staged changes
   - `git log --oneline -5` to see recent commit style

2. **Stage appropriate files**:
   - Stage all related changes with `git add`
   - Do NOT stage files that appear to contain secrets (.env, credentials, API keys, tokens)
   - If you detect potential secrets, warn the user and skip those files

3. **Determine the commit type** based on the changes:
   - `feat`: New feature or capability
   - `fix`: Bug fix
   - `docs`: Documentation only
   - `style`: Formatting, whitespace (not CSS)
   - `refactor`: Code restructuring without behavior change
   - `perf`: Performance improvement
   - `test`: Adding or updating tests
   - `build`: Build system or dependencies
   - `ci`: CI/CD configuration
   - `chore`: Maintenance tasks, tooling, config

   NOTE: Do not use a scope for commits

4. **Write the commit message**:
   - **Subject line**: `<type>: <description>`
     - Use imperative mood ("add" not "added")
     - Lowercase, no period at end
     - Max 50 characters if possible, 72 hard limit
   - **Body** (if needed): Explain _why_, not _what_
     - Wrap at 72 characters
     - Separate from subject with blank line

## Commit Format

```
<type>[scope]: <subject>

[optional body explaining WHY this change was made]
```

## Examples

Simple change:

```
fix: handle empty input in parser without throwing
```

With body:

```
feat: add streaming response support

Large responses were causing memory issues in production.
Streaming allows processing chunks incrementally.
```

## Rules

- NEVER commit files that may contain secrets
- NEVER use `git commit --amend` unless the user explicitly requests it
- NEVER use `--no-verify` to skip hooks
- If the pre-commit hook fails, fix the issues and create a NEW commit
- If there are no changes to commit, inform the user and stop
- Use a HEREDOC to pass the commit message to ensure proper formatting

## Execute

Run the git commands to analyze, stage, and commit the changes now.
