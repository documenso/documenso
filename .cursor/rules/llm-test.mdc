---
description: Guidelines for writing tests for LLM-related functionality
globs: 
alwaysApply: false
---
# LLM Testing Guidelines

Tests for LLM-related functionality should follow these guidelines to ensure consistency and reliability.

## Test File Structure

1. Place all LLM-related tests in `apps/web/__tests__/`:

   ```
   apps/web/__tests__/
   │ └── your-feature.test.ts
   │ └── another-feature.test.ts
   └── ...
   ```

2. Basic test file template:

   ```typescript
   import { describe, expect, test, vi, beforeEach } from "vitest";
   import { yourFunction } from "@/utils/ai/your-feature";

   // Run with: pnpm test-ai TEST

   vi.mock("server-only", () => ({}));

   // Skip tests unless explicitly running AI tests
   const isAiTest = process.env.RUN_AI_TESTS === "true";

   describe.runIf(isAiTest)("yourFunction", () => {
     beforeEach(() => {
       vi.clearAllMocks();
     });

     test("test case description", async () => {
       // Test implementation
     });
   }, 15_000);
   ```

## Helper Functions

1. Always create helper functions for common test data:

   ```typescript
   function getUser() {
     return {
       email: "user@test.com",
       aiModel: null,
       aiProvider: null,
       aiApiKey: null,
       about: null,
     };
   }

   function getTestData(overrides = {}) {
     return {
       // Default test data
       ...overrides,
     };
   }
   ```

## Test Cases

1. Include these standard test cases:

   - Happy path with expected input
   - Error handling
   - Edge cases (empty input, null values)
   - Different user configurations
   - Various input formats

2. Example test structure:

   ```typescript
   test("successfully processes valid input", async () => {
     const result = await yourFunction({
       input: getTestData(),
       user: getUser(),
     });
     expect(result).toMatchExpectedFormat();
   });

   test("handles errors gracefully", async () => {
     const result = await yourFunction({
       input: getTestData({ invalid: true }),
       user: getUser(),
     });
     expect(result.error).toBeDefined();
   });
   ```

## Best Practices

1. Set appropriate timeouts for LLM calls:

   ```typescript
   test("handles long-running LLM operations", async () => {
     // ...
   }, 15_000); // 15 second timeout
   ```

2. Use descriptive console.debug for generated content:

   ```typescript
   console.debug("Generated content:\n", result.content);
   ```

3. Do not mock the LLM call. We want to call the actual LLM in these tests.

4. Test both AI and non-AI paths:
   ```typescript
   test("returns unchanged when no AI processing needed", async () => {
     const input = getTestData({ requiresAi: false });
     const result = await yourFunction(input);
     expect(result).toEqual(input);
   });
   ```

## Running Tests

Run AI tests with:

   ```bash
   pnpm test-ai your-feature
   ```
