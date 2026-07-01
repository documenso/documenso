import path from 'node:path';

import type { FieldWithSignature } from '@documenso/prisma/types/field-with-signature';
import { FieldType } from '@prisma/client';
import { afterEach, describe, expect, it } from 'vitest';

import { insertFieldInPDFV2 } from './insert-field-in-pdf-v2';

const originalCwd = process.cwd();

describe('insertFieldInPDFV2', () => {
  afterEach(() => {
    process.chdir(originalCwd);
  });

  it('exports styled text fields into a PDF overlay', async () => {
    process.chdir(path.join(originalCwd, '../../apps/remix'));

    const pdf = await insertFieldInPDFV2({
      pageWidth: 400,
      pageHeight: 400,
      fields: [
        {
          id: 1,
          secondaryId: 'styled-text',
          type: FieldType.TEXT,
          page: 1,
          positionX: 10,
          positionY: 10,
          width: 40,
          height: 10,
          customText: 'Styled final text',
          inserted: true,
          fieldMeta: {
            type: 'text',
            fontSize: 14,
            fontWeight: 'bold',
            fontStyle: 'italic',
          },
        } as unknown as FieldWithSignature,
      ],
    });

    expect(Buffer.from(pdf).subarray(0, 4).toString()).toBe('%PDF');
  });
});
