import { describe, expect, it } from 'vitest';

import { resolveDocumentSender } from './document-sender';

const user = {
  name: 'John Doe',
  email: 'john@acme.com',
};

const team = {
  name: 'Acme',
  teamEmail: { email: 'billing@acme.com' },
};

describe('resolveDocumentSender', () => {
  it('discloses the individual sender when includeSenderDetails is enabled', () => {
    expect(resolveDocumentSender({ includeSenderDetails: true, user, team })).toEqual({
      name: 'John Doe',
      email: 'john@acme.com',
    });
  });

  it('withholds the individual sender and shows the team when includeSenderDetails is disabled', () => {
    expect(resolveDocumentSender({ includeSenderDetails: false, user, team })).toEqual({
      name: 'Acme',
      email: 'billing@acme.com',
    });
  });

  it('never leaks the individual name or email when includeSenderDetails is disabled', () => {
    const sender = resolveDocumentSender({ includeSenderDetails: false, user, team });

    expect(sender.name).not.toBe(user.name);
    expect(sender.email).not.toBe(user.email);
  });

  it('falls back to empty strings when the team has no name or team email', () => {
    expect(
      resolveDocumentSender({
        includeSenderDetails: false,
        user,
        team: { name: null, teamEmail: null },
      }),
    ).toEqual({
      name: '',
      email: '',
    });
  });

  it('does not fall back to the individual sender when the team is missing', () => {
    const sender = resolveDocumentSender({ includeSenderDetails: false, user, team: null });

    expect(sender).toEqual({ name: '', email: '' });
    expect(sender.email).not.toBe(user.email);
  });

  it('falls back to an empty name when the individual sender has no name set', () => {
    expect(
      resolveDocumentSender({
        includeSenderDetails: true,
        user: { name: null, email: 'john@acme.com' },
        team,
      }),
    ).toEqual({
      name: '',
      email: 'john@acme.com',
    });
  });
});
