import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const here = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(here, './create-envelope-fields.ts'), 'utf8');

describe('createEnvelopeFields field meta validation', () => {
  it('imports the configuration validator', () => {
    expect(source).toMatch(
      /import\s+\{[^}]*validateFieldMetaConfiguration[^}]*\}\s+from\s+'[^']*validate-field-meta-configuration'/,
    );
  });

  it('runs the validator inside the per-field validation block', () => {
    expect(source).toContain('validateFieldMetaConfiguration(field.type, field.fieldMeta)');
  });

  it('surfaces violations as a 400 INVALID_REQUEST, not a 500', () => {
    const guard = source.match(
      /const fieldMetaErrors = validateFieldMetaConfiguration[\s\S]{0,400}?AppErrorCode\.INVALID_REQUEST/,
    );

    expect(guard).not.toBeNull();
  });
});
