# Agent Guidelines for Documenso

## Build/Test/Lint Commands

- `npm run build` - Build all packages
- `npm run lint` - Lint all packages
- `npm run lint:fix` - Auto-fix linting issues
- `npm run test:e2e` - Run E2E tests with Playwright
- `CI=true npm run test:dev -w @documenso/app-tests -- e2e/path/to/file.spec.ts` - Run a single E2E test against a running dev server
- `npm run test-ui:dev -w @documenso/app-tests` - Run E2E tests with UI
- `npm run format` - Format code with Biome
- `npm run dev` - Start development server for the React Router app (`apps/remix`)

**Important:** Do not run `npm run build` to verify changes unless explicitly asked. Builds take a long time (~2 minutes). Use `npm run typecheck -w @documenso/remix` for the app (it runs `react-router typegen` first) or `npx tsc --noEmit` inside other packages.

**Important:** Always set `CI=true` when running Playwright. Without it the browser runs headfully.

## Code Style Guidelines

- Use TypeScript for all code; prefer `type` over `interface`
- Use functional components with `const Component = () => {}`
- Never use classes; prefer functional/declarative patterns
- Use descriptive variable names with auxiliary verbs (isLoading, hasError)
- Directory names: lowercase with dashes (auth-wizard)
- Use named exports for components
- Never use 1-line if statements
- Structure files: exported component, subcomponents, helpers, static content, types

## Error Handling & Validation

- Use custom AppError class when throwing errors
- When catching errors on the frontend use `const error = AppError.parse(error)` to get the error code
- Use early returns and guard clauses
- Use Zod for form validation and react-hook-form for forms
- Use error boundaries for unexpected errors

## UI & Styling

- Use Shadcn UI, Radix, and Tailwind CSS with mobile-first approach
- Use `<Form>` `<FormItem>` elements with fieldset having `:disabled` attribute when loading
- Use Lucide icons with longhand names (HomeIcon vs Home)

## TRPC Routes

- Each route in own file: `routers/teams/create-team.ts`
- Associated types file: `routers/teams/create-team.types.ts`
- Request/response schemas: `Z[RouteName]RequestSchema`, `Z[RouteName]ResponseSchema`
- Only use GET and POST methods in OpenAPI meta
- Deconstruct input argument on its own line
- Prefer route names such as get/getMany/find/create/update/delete
- "create" routes request schema should have the ID and data in the top level
- "update" routes request schema should have the ID in the top level and the data in a nested "data" object

## Translations & React Router

- Use `<Trans>string</Trans>` for JSX translations from `@lingui/react/macro`
- Use `t\`string\`` macro for TypeScript translations
- Use `(params: Route.Params)` and `(loaderData: Route.LoaderData)` for routes
- Directly return data from loaders, don't use `json()`
- Use `superLoaderJson` when sending complex data through loaders such as dates or prisma decimals

## Testing

- Write few tests, each high value. One test per behaviour, not one per line of code
- Cover the happy path and the adversarial path: wrong user, wrong team, expired token, missing permission, malformed input
- Never mock. If a test would need a mock, write a Playwright E2E test in `packages/app-tests` against the real database and server instead
- Vitest (`packages/lib`, `packages/signing`) is only for pure functions with no I/O
- Every assertion must be able to fail. Never write `expect(true).toBe(true)`, assert on a value you just hard-coded, or assert only that a function "was called"
- A test that only confirms the code runs without throwing is not a test; delete it
- Do not add tests for trivial code (getters, pass-through wrappers, type-only changes)

## Comments

- Default to no comment. Clear naming and small functions should make the code readable on its own
- A comment must explain something the code cannot: the why, a constraint, a non-obvious consequence, a trap for the next person
- Never narrate what the next line does (`// loop over the users`, `// return the result`)
- Never leave section-header comments, TODO notes for work you are doing now, or commented-out code
- JSDoc on exported functions only when the signature alone is not enough

Good comment, from `packages/lib/server-only/rate-limit/rate-limits.ts`:

```ts
// IP only: the nonce must never be a rate limit key (it would be persisted in plaintext).
// The client polls every 2s, so this allows ~40 concurrent flows behind one IP.
export const embedAuthRedeemRateLimit = createRateLimit({
  action: 'auth.embed-redeem',
  max: 1200,
  window: '1m',
});
```

It states a security constraint and the arithmetic behind a magic number. Neither is recoverable from the code.

## Communication

- Lead with the answer or the action. No preamble ("I'll now...", "Great question"), no closing pleasantries
- Keep responses short. Say what changed, where, and what to do next. Skip recaps of work the reader just watched happen
- Number multi-step instructions; one bounded action per step
- Finish the task at hand before raising a tangent. Raise it once, at the end, as a separate question
- For errors, state cause and fix plainly. No "uh oh", no hedging that carries no information
