import { describe, expect, it } from 'vitest';

import { resolveFontDisplayName } from './font-display-name';

describe('resolveFontDisplayName', () => {
  it('uses a trimmed custom display name when provided', () => {
    expect(resolveFontDisplayName({ displayName: '  Company Contract Font  ', parsedName: 'Parsed Font Name' })).toBe(
      'Company Contract Font',
    );
  });

  it('falls back to the parsed font name when no display name is provided', () => {
    expect(resolveFontDisplayName({ displayName: '   ', parsedName: 'Parsed Font Name' })).toBe('Parsed Font Name');
  });
});
