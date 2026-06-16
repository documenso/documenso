import { describe, expect, it } from 'vitest';

import { ZTextFieldMeta } from './field-meta';

describe('field font metadata', () => {
  it('preserves the selected font family for text fields', () => {
    const result = ZTextFieldMeta.parse({
      type: 'text',
      text: 'Signed in a custom font',
      fontFamily: 'font_team_123',
    });

    expect(result.fontFamily).toBe('font_team_123');
  });

  it('preserves bold and italic text styling for text fields', () => {
    const result = ZTextFieldMeta.parse({
      type: 'text',
      text: 'Signed in a styled font',
      fontWeight: 'bold',
      fontStyle: 'italic',
    });

    expect(result.fontWeight).toBe('bold');
    expect(result.fontStyle).toBe('italic');
  });
});
