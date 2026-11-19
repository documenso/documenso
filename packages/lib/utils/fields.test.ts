import { describe, expect, it } from 'vitest';

import { parseCheckboxCustomText } from './fields';

describe('parseCheckboxCustomText', () => {
  it('returns the selected indices, and none for an empty value', () => {
    expect(parseCheckboxCustomText('[0,2]')).toEqual([0, 2]);
    expect(parseCheckboxCustomText('')).toEqual([]);
  });

  it('rejects a value which is not a list of indices', () => {
    for (const customText of ['abc', '{"0":true}', '"0"', '[0.5]', '[-1]', '["0"]']) {
      expect(() => parseCheckboxCustomText(customText)).toThrow('Invalid checkbox values');
    }
  });
});
