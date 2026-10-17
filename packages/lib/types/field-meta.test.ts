import { describe, expect, it } from 'vitest';

import { ZBaseFieldMeta, ZCheckboxFieldMeta, ZRadioFieldMeta, ZTextFieldMeta } from './field-meta';

describe('hideLabel', () => {
  it('accepts a boolean, null or omitted hideLabel on checkbox and radio fields', () => {
    expect(ZCheckboxFieldMeta.safeParse({ type: 'checkbox', hideLabel: true }).success).toBe(true);
    expect(ZCheckboxFieldMeta.safeParse({ type: 'checkbox', hideLabel: null }).success).toBe(true);
    expect(ZCheckboxFieldMeta.safeParse({ type: 'checkbox' }).success).toBe(true);
    expect(ZRadioFieldMeta.safeParse({ type: 'radio', hideLabel: true }).success).toBe(true);
  });

  it('rejects a non-boolean hideLabel', () => {
    expect(ZCheckboxFieldMeta.safeParse({ type: 'checkbox', hideLabel: 'yes' }).success).toBe(false);
  });

  it('is not part of other field metas', () => {
    expect('hideLabel' in ZBaseFieldMeta.shape).toBe(false);
    expect('hideLabel' in ZTextFieldMeta.shape).toBe(false);
  });
});
