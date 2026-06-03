// ABOUTME: Unit tests for Google Directory API client covering user lookup, group listing, pagination, and error handling.
// ABOUTME: Mocks googleapis and env utility to test directory-client logic in isolation.

/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/consistent-type-assertions */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockUsersGet = vi.fn();
const mockGroupsList = vi.fn();

vi.mock('googleapis', () => ({
  google: {
    auth: {
      // Must be a real function (not arrow) so it can be called with `new`
      // eslint-disable-next-line prefer-arrow-callback
      JWT: vi.fn(function () {
        return { mockJWT: true };
      }),
    },
    admin: vi.fn().mockReturnValue({
      users: { get: mockUsersGet },
      groups: { list: mockGroupsList },
    }),
  },
}));

vi.mock('@documenso/lib/utils/env', () => ({
  env: vi.fn((key: string) => {
    if (key === 'GOOGLE_SERVICE_ACCOUNT_KEY') return JSON.stringify({ type: 'service_account' });
    if (key === 'GOOGLE_DIRECTORY_ADMIN_EMAIL') return 'admin@example.com';
    return undefined;
  }),
}));

describe('getDirectoryUser', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('returns department, title, and orgUnitPath on success', async () => {
    mockUsersGet.mockResolvedValue({
      data: {
        organizations: [{ department: 'Engineering', title: 'Software Engineer' }],
        orgUnitPath: '/Staff/Engineering',
      },
    });

    const { getDirectoryUser } = await import('./directory-client');
    const result = await getDirectoryUser('user@example.com');

    expect(result).toEqual({
      department: 'Engineering',
      title: 'Software Engineer',
      orgUnitPath: '/Staff/Engineering',
    });
    expect(mockUsersGet).toHaveBeenCalledWith(
      expect.objectContaining({ userKey: 'user@example.com', projection: 'full' }),
    );
  });

  it('returns null fields when user has no organizations array', async () => {
    mockUsersGet.mockResolvedValue({
      data: {
        orgUnitPath: '/Staff',
      },
    });

    const { getDirectoryUser } = await import('./directory-client');
    const result = await getDirectoryUser('user@example.com');

    expect(result).toEqual({
      department: null,
      title: null,
      orgUnitPath: '/Staff',
    });
  });

  it('returns null on API error (403)', async () => {
    const err = new Error('Forbidden');
    (err as any).code = 403;
    mockUsersGet.mockRejectedValue(err);

    const { getDirectoryUser } = await import('./directory-client');
    const result = await getDirectoryUser('user@example.com');

    expect(result).toBeNull();
  });

  it('returns null on impersonation failure (401)', async () => {
    const err = new Error('Unauthorized');
    (err as any).code = 401;
    mockUsersGet.mockRejectedValue(err);

    const { getDirectoryUser } = await import('./directory-client');
    const result = await getDirectoryUser('user@example.com');

    expect(result).toBeNull();
  });

  it('returns null on network failure', async () => {
    mockUsersGet.mockRejectedValue(new Error('ECONNREFUSED'));

    const { getDirectoryUser } = await import('./directory-client');
    const result = await getDirectoryUser('user@example.com');

    expect(result).toBeNull();
  });
});

describe('getDirectoryGroups', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('returns group emails on success', async () => {
    mockGroupsList.mockResolvedValue({
      data: {
        groups: [
          { email: 'group-a@example.com' },
          { email: 'group-b@example.com' },
        ],
        nextPageToken: undefined,
      },
    });

    const { getDirectoryGroups } = await import('./directory-client');
    const result = await getDirectoryGroups('user@example.com');

    expect(result).toEqual(['group-a@example.com', 'group-b@example.com']);
    expect(mockGroupsList).toHaveBeenCalledWith(
      expect.objectContaining({ userKey: 'user@example.com' }),
    );
  });

  it('follows pagination across multiple pages', async () => {
    mockGroupsList
      .mockResolvedValueOnce({
        data: {
          groups: [{ email: 'group-a@example.com' }],
          nextPageToken: 'token-page-2',
        },
      })
      .mockResolvedValueOnce({
        data: {
          groups: [{ email: 'group-b@example.com' }],
          nextPageToken: undefined,
        },
      });

    const { getDirectoryGroups } = await import('./directory-client');
    const result = await getDirectoryGroups('user@example.com');

    expect(result).toEqual(['group-a@example.com', 'group-b@example.com']);
    expect(mockGroupsList).toHaveBeenCalledTimes(2);
    expect(mockGroupsList).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ pageToken: 'token-page-2' }),
    );
  });

  it('returns empty array for user with no groups', async () => {
    mockGroupsList.mockResolvedValue({
      data: {
        groups: [],
        nextPageToken: undefined,
      },
    });

    const { getDirectoryGroups } = await import('./directory-client');
    const result = await getDirectoryGroups('user@example.com');

    expect(result).toEqual([]);
  });

  it('returns empty array when groups field is absent', async () => {
    mockGroupsList.mockResolvedValue({
      data: {},
    });

    const { getDirectoryGroups } = await import('./directory-client');
    const result = await getDirectoryGroups('user@example.com');

    expect(result).toEqual([]);
  });

  it('returns null on API error', async () => {
    mockGroupsList.mockRejectedValue(new Error('Service Unavailable'));

    const { getDirectoryGroups } = await import('./directory-client');
    const result = await getDirectoryGroups('user@example.com');

    expect(result).toBeNull();
  });

  it('filters out entries without a string email field', async () => {
    mockGroupsList.mockResolvedValue({
      data: {
        groups: [
          { email: 'valid@example.com' },
          { name: 'no-email-group' },
          { email: 42 },
          { email: null },
          { email: 'also-valid@example.com' },
        ],
        nextPageToken: undefined,
      },
    });

    const { getDirectoryGroups } = await import('./directory-client');
    const result = await getDirectoryGroups('user@example.com');

    expect(result).toEqual(['valid@example.com', 'also-valid@example.com']);
  });
});
