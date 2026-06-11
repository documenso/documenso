import { FieldType } from '@prisma/client';
import { describe, expect, it } from 'vitest';

import {
  buildBulkSendPrefillFields,
  getBulkSendFieldColumnName,
  isBulkSendPrefillableFieldType,
} from './bulk-send';

describe('isBulkSendPrefillableFieldType', () => {
  it('accepts advanced field types that support merge data', () => {
    expect(isBulkSendPrefillableFieldType(FieldType.TEXT)).toBe(true);
    expect(isBulkSendPrefillableFieldType(FieldType.NUMBER)).toBe(true);
    expect(isBulkSendPrefillableFieldType(FieldType.RADIO)).toBe(true);
    expect(isBulkSendPrefillableFieldType(FieldType.CHECKBOX)).toBe(true);
    expect(isBulkSendPrefillableFieldType(FieldType.DROPDOWN)).toBe(true);
    expect(isBulkSendPrefillableFieldType(FieldType.DATE)).toBe(true);
  });

  it('rejects field types that cannot be prefilled', () => {
    expect(isBulkSendPrefillableFieldType(FieldType.SIGNATURE)).toBe(false);
    expect(isBulkSendPrefillableFieldType(FieldType.NAME)).toBe(false);
    expect(isBulkSendPrefillableFieldType(FieldType.EMAIL)).toBe(false);
  });
});

describe('buildBulkSendPrefillFields', () => {
  it('maps field_<id> columns to typed prefill entries', () => {
    const fields = [
      { id: 1, type: FieldType.TEXT },
      { id: 2, type: FieldType.NUMBER },
    ];

    const row = {
      recipient_1_email: 'a@example.com',
      [getBulkSendFieldColumnName(1)]: 'Hello World',
      [getBulkSendFieldColumnName(2)]: '42',
    };

    expect(buildBulkSendPrefillFields(fields, row)).toEqual([
      { id: 1, type: 'text', value: 'Hello World' },
      { id: 2, type: 'number', value: '42' },
    ]);
  });

  it('skips blank cells so the template default is preserved', () => {
    const fields = [
      { id: 1, type: FieldType.TEXT },
      { id: 2, type: FieldType.TEXT },
    ];

    const row = {
      [getBulkSendFieldColumnName(1)]: '   ',
      [getBulkSendFieldColumnName(2)]: 'Filled',
    };

    expect(buildBulkSendPrefillFields(fields, row)).toEqual([
      { id: 2, type: 'text', value: 'Filled' },
    ]);
  });

  it('ignores fields whose type cannot be prefilled', () => {
    const fields = [
      { id: 1, type: FieldType.SIGNATURE },
      { id: 2, type: FieldType.TEXT },
    ];

    const row = {
      [getBulkSendFieldColumnName(1)]: 'ignored',
      [getBulkSendFieldColumnName(2)]: 'kept',
    };

    expect(buildBulkSendPrefillFields(fields, row)).toEqual([
      { id: 2, type: 'text', value: 'kept' },
    ]);
  });

  it('splits checkbox values on the delimiter into an array', () => {
    const fields = [{ id: 5, type: FieldType.CHECKBOX }];

    const row = {
      [getBulkSendFieldColumnName(5)]: 'Option A; Option B ;;Option C',
    };

    expect(buildBulkSendPrefillFields(fields, row)).toEqual([
      { id: 5, type: 'checkbox', value: ['Option A', 'Option B', 'Option C'] },
    ]);
  });

  it('returns an empty array when no field columns are present', () => {
    const fields = [{ id: 1, type: FieldType.TEXT }];

    expect(buildBulkSendPrefillFields(fields, { recipient_1_email: 'a@example.com' })).toEqual([]);
  });
});
