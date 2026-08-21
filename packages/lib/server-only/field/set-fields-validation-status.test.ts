import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const here = dirname(fileURLToPath(import.meta.url));
const read = (rel: string) => readFileSync(join(here, rel), 'utf8');

describe('setFields validation error status', () => {
  it('set-fields-for-document reports validation failures as 400 INVALID_REQUEST', () => {
    const source = read('./set-fields-for-document.ts');

    expect(source).not.toMatch(/throw new Error\(errors\.join/);
    expect(source).not.toMatch(/throw new Error\('To proceed further/);
    expect((source.match(/AppError\(AppErrorCode\.INVALID_REQUEST/g) ?? []).length).toBeGreaterThanOrEqual(8);
  });

  it('set-fields-for-template reports validation failures as 400 INVALID_REQUEST', () => {
    const source = read('./set-fields-for-template.ts');

    expect(source).not.toMatch(/throw new Error\(errors\.join/);
    expect(source).not.toMatch(/throw new Error\('.*missing required metadata/);
    expect((source.match(/AppError\(AppErrorCode\.INVALID_REQUEST/g) ?? []).length).toBeGreaterThanOrEqual(6);
  });

  it('the internal upsert invariant is unchanged', () => {
    const source = read('./set-fields-for-document.ts');

    expect(source).toContain("throw new Error('Not possible')");
  });
});
