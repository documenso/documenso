---
description: Continue implementing a spec from a previous session
argument-hint: <spec-file-path>
---

You are continuing implementation of a specification that was started in a previous session. Work autonomously until the feature is complete and tests pass.

## Your Task

1. **Read the spec** at `$ARGUMENTS`
2. **Read CODE_STYLE.md** for formatting conventions
3. **Assess current state**:
   - Check git status for uncommitted changes
   - Run tests to see what's passing/failing (if E2E tests exist)
   - Review any existing implementation
4. **Determine what remains** by comparing the spec to the current state
5. **Plan remaining work** using TodoWrite
6. **Continue implementing** until complete

## Assessing Current State

Run these commands to understand where the previous session left off:

```bash
git status                                    # See uncommitted changes
git log --oneline -10                         # See recent commits
pnpm run typecheck -w @documenso/remix         # Check for type errors
pnpm run lint:fix                              # Check for linting issues
```

Review the code that's already been written to understand:

- What's already implemented
- What's partially done
- What's not started yet

## Implementation Guidelines

### During Implementation

- Follow CODE_STYLE.md strictly (2-space indent, double quotes, braces always, etc.)
- Follow workspace rules for TypeScript, React, TRPC patterns, and Remix conventions
- Mark todos complete as you finish each task
- Commit logical chunks of work

### Code Quality

- No stubbed implementations
- Handle edge cases and error conditions
- Include descriptive error messages with context
- Use async/await for all I/O operations
- Use AppError class when throwing errors
- Use Zod for validation and react-hook-form for forms

### Testing

**Important**: E2E tests are time-consuming. Only write tests for non-trivial functionality.

- Write E2E tests in `packages/app-tests/e2e/` using Playwright
- Test critical user flows and edge cases
- Follow existing E2E test patterns in the codebase
- Use descriptive test names that explain what is being tested
- Skip tests for trivial changes (simple UI tweaks, minor refactors, etc.)

## Autonomous Workflow

Work continuously through these steps:

1. **Implement** - Write the code for the current task
2. **Typecheck** - Run `pnpm run typecheck -w @documenso/remix` to verify types
3. **Lint** - Run `pnpm run lint:fix` to fix linting issues
4. **Test** - If non-trivial, run E2E tests: `pnpm run test:dev -w @documenso/app-tests`
5. **Fix** - If tests fail, fix and re-run
6. **Repeat** - Move to next task

## Stopping Conditions

**Stop and report success when:**

- All spec requirements are implemented
- Typecheck passes
- Lint passes
- E2E tests pass (if written for non-trivial functionality)

**Stop and ask for help when:**

- The spec is ambiguous and you need clarification
- You encounter a blocking issue you cannot resolve
- You need to make a decision that significantly deviates from the spec
- External dependencies are missing

## Commands

```bash
# Type checking
pnpm run typecheck -w @documenso/remix

# Linting
pnpm run lint:fix

# E2E Tests (only for non-trivial work)
pnpm run test:dev -w @documenso/app-tests              # Run E2E tests in dev mode
pnpm run test-ui:dev -w @documenso/app-tests            # Run E2E tests with UI
pnpm run test:e2e                                       # Run full E2E test suite

# Development
pnpm run dev                                            # Start dev server
```

## Begin

Read the spec file and CODE_STYLE.md, assess the current implementation state, then continue where the previous session left off. Use TodoWrite to track your progress throughout.
