import { describe, expect, it } from 'vitest';

import { renderCustomEmailTemplate } from './render-custom-email-template';

describe('renderCustomEmailTemplate', () => {
  const variables = {
    first: 'John',
    last: 'Doe',
    'document.name': 'Contract',
  };

  it('replaces a single placeholder', () => {
    expect(renderCustomEmailTemplate('Hello {first}', variables)).toBe('Hello John');
  });

  it('replaces placeholders separated by whitespace', () => {
    expect(renderCustomEmailTemplate('{first} {last}', variables)).toBe('John Doe');
  });

  // Regression: a greedy "\S+" matched from the first "{" to the last "}",
  // corrupting adjacent placeholders (or placeholders joined by a non-space char).
  it('replaces adjacent placeholders individually', () => {
    expect(renderCustomEmailTemplate('{first}{last}', variables)).toBe('JohnDoe');
  });

  it('replaces placeholders joined by a non-whitespace character', () => {
    expect(renderCustomEmailTemplate('{first}-{last}', variables)).toBe('John-Doe');
  });

  it('keeps dotted keys working', () => {
    expect(renderCustomEmailTemplate('Re: {document.name}', variables)).toBe('Re: Contract');
  });

  it('leaves unknown placeholders as their key', () => {
    expect(renderCustomEmailTemplate('Hi {unknown}', variables)).toBe('Hi unknown');
  });

  it('returns the template unchanged when there are no placeholders', () => {
    expect(renderCustomEmailTemplate('No placeholders here', variables)).toBe('No placeholders here');
  });
});
