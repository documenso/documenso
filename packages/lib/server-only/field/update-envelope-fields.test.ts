import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const here = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(here, './update-envelope-fields.ts'), 'utf8');

describe('updateEnvelopeFields field meta validation', () => {
  it('imports the configuration validator', () => {
    expect(source).toMatch(
      /import\s+\{[^}]*validateFieldMetaConfiguration[^}]*\}\s+from\s+'[^']*validate-field-meta-configuration'/,
    );
  });

  it('validates the provided meta against the effective field type', () => {
    expect(source).toContain('validateFieldMetaConfiguration(fieldType, field.fieldMeta)');
  });

  it('surfaces violations as a 400 INVALID_REQUEST', () => {
    const guard = source.match(
      /const fieldMetaErrors = validateFieldMetaConfiguration[\s\S]{0,400}?AppErrorCode\.INVALID_REQUEST/,
    );

    expect(guard).not.toBeNull();
  });
});
