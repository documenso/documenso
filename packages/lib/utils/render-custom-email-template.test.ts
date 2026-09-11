import { describe, expect, it } from 'vitest';

import { renderCustomEmailTemplate } from './render-custom-email-template';

describe('renderCustomEmailTemplate', () => {
  it('replaces a single variable', () => {
    expect(renderCustomEmailTemplate('Hi {name}', { name: 'Sam' })).toBe('Hi Sam');
  });

  it('replaces multiple variables separated by whitespace', () => {
    expect(
      renderCustomEmailTemplate('Hi {name}, sign at {url}', { name: 'Sam', url: 'https://x' }),
    ).toBe('Hi Sam, sign at https://x');
  });

  it('replaces adjacent variables and variables separated by a non-whitespace character', () => {
    expect(
      renderCustomEmailTemplate('{day}/{month}/{year}', { day: '01', month: '02', year: '2026' }),
    ).toBe('01/02/2026');

    expect(
      renderCustomEmailTemplate('{firstName}-{lastName}', {
        firstName: 'Ada',
        lastName: 'Lovelace',
      }),
    ).toBe('Ada-Lovelace');
  });

  it('leaves the key in place when the variable is not provided', () => {
    expect(renderCustomEmailTemplate('Unknown {missing} here', {})).toBe('Unknown missing here');
  });
});
