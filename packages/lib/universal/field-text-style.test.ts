import { describe, expect, it } from 'vitest';

import { getFieldTextStyle, getKonvaFieldTextStyle } from './field-text-style';

describe('field text style', () => {
  it('maps bold and italic metadata to CSS styles', () => {
    expect(
      getFieldTextStyle({
        fontWeight: 'bold',
        fontStyle: 'italic',
      }),
    ).toEqual({
      fontWeight: 700,
      fontStyle: 'italic',
    });
  });

  it('maps bold and italic metadata to Konva text styles', () => {
    expect(
      getKonvaFieldTextStyle({
        fontWeight: 'bold',
        fontStyle: 'italic',
      }),
    ).toEqual({
      fontStyle: 'bold italic',
    });
  });

  it('defaults to normal text styles', () => {
    expect(getFieldTextStyle({})).toEqual({
      fontWeight: 400,
      fontStyle: 'normal',
    });

    expect(getKonvaFieldTextStyle({})).toEqual({
      fontStyle: 'normal',
    });
  });
});
