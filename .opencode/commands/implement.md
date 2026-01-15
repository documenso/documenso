---
description: Implement a spec from the plans directory
argument-hint: <spec-file-path>
---

You are implementing a specification from the `.agents/plans/` directory. Work autonomously until the feature is complete and tests pass.

## Your Task

1. **Read the spec** at `$ARGUMENTS`
2. **Read CODE_STYLE.md** for formatting conventions
3. **Plan the implementation** using the TodoWrite tool to break down the work
4. **Implement the feature** following the spec and code style
5. **Write E2E tests** only for non-trivial functionality (E2E tests are time-consuming)
6. **Run tests** and fix any failures
7. **Run typecheck and lint** and fix any issues

## Implementation Guidelines

### Before Coding

- Understand the spec's goals and scope
- Identify the desired API from usage examples in the spec
- Review related existing code to understand patterns
- Break the work into discrete tasks using TodoWrite

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
2. **Typecheck** - Run `npm run typecheck -w @documenso/remix` to verify types
3. **Lint** - Run `npm run lint:fix` to fix linting issues
4. **Test** - If non-trivial, run E2E tests: `npm run test:dev -w @documenso/app-tests`
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
npm run typecheck -w @documenso/remix

# Linting
npm run lint:fix

# E2E Tests (only for non-trivial work)
npm run test:dev -w @documenso/app-tests              # Run E2E tests in dev mode
npm run test-ui:dev -w @documenso/app-tests            # Run E2E tests with UI
npm run test:e2e                                       # Run full E2E test suite

# Development
npm run dev                                            # Start dev server
```

## Begin

Read the spec file and CODE_STYLE.md, then start implementing. Use TodoWrite to track your progress throughout.
