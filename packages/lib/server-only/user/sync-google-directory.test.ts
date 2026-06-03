// ABOUTME: Unit tests for the Google Directory sync orchestrator covering feature gating,
// ABOUTME: throttle logic, partial-result handling, and error containment.

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockFindUnique = vi.fn();
const mockUpdate = vi.fn();
const mockGetDirectoryUser = vi.fn();
const mockGetDirectoryGroups = vi.fn();
const mockEnv = vi.fn();

vi.mock('@documenso/prisma', () => ({
  prisma: {
    user: {
      findUnique: mockFindUnique,
      update: mockUpdate,
    },
  },
}));

vi.mock('../google/directory-client', () => ({
  getDirectoryUser: mockGetDirectoryUser,
  getDirectoryGroups: mockGetDirectoryGroups,
}));

vi.mock('../../utils/env', () => ({
  env: mockEnv,
}));

describe('syncGoogleDirectory', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('returns immediately when feature gate is disabled', async () => {
    mockEnv.mockReturnValue(undefined);

    const { syncGoogleDirectory } = await import('./sync-google-directory');
    await syncGoogleDirectory(1, 'user@example.com');

    expect(mockFindUnique).not.toHaveBeenCalled();
    expect(mockGetDirectoryUser).not.toHaveBeenCalled();
    expect(mockGetDirectoryGroups).not.toHaveBeenCalled();
  });

  it('returns early when synced within the last hour (30 min ago)', async () => {
    mockEnv.mockReturnValue('true');

    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
    mockFindUnique.mockResolvedValue({ directoryLastSyncedAt: thirtyMinutesAgo });

    const { syncGoogleDirectory } = await import('./sync-google-directory');
    await syncGoogleDirectory(1, 'user@example.com');

    expect(mockFindUnique).toHaveBeenCalledWith({
      where: { id: 1 },
      select: { directoryLastSyncedAt: true },
    });
    expect(mockGetDirectoryUser).not.toHaveBeenCalled();
    expect(mockGetDirectoryGroups).not.toHaveBeenCalled();
  });

  it('proceeds with sync when synced 61 minutes ago', async () => {
    mockEnv.mockReturnValue('true');

    const sixtyOneMinutesAgo = new Date(Date.now() - 61 * 60 * 1000);
    mockFindUnique.mockResolvedValue({ directoryLastSyncedAt: sixtyOneMinutesAgo });
    mockGetDirectoryUser.mockResolvedValue({
      department: 'IT',
      title: 'Engineer',
      orgUnitPath: '/Staff',
    });
    mockGetDirectoryGroups.mockResolvedValue(['group@example.com']);

    const { syncGoogleDirectory } = await import('./sync-google-directory');
    await syncGoogleDirectory(1, 'user@example.com');

    expect(mockGetDirectoryUser).toHaveBeenCalledWith('user@example.com');
    expect(mockGetDirectoryGroups).toHaveBeenCalledWith('user@example.com');
    expect(mockUpdate).toHaveBeenCalled();
  });

  it('proceeds with sync when directoryLastSyncedAt is null (first sync)', async () => {
    mockEnv.mockReturnValue('true');

    mockFindUnique.mockResolvedValue({ directoryLastSyncedAt: null });
    mockGetDirectoryUser.mockResolvedValue({
      department: 'IT',
      title: 'Engineer',
      orgUnitPath: '/Staff',
    });
    mockGetDirectoryGroups.mockResolvedValue(['group@example.com']);

    const { syncGoogleDirectory } = await import('./sync-google-directory');
    await syncGoogleDirectory(1, 'user@example.com');

    expect(mockGetDirectoryUser).toHaveBeenCalledWith('user@example.com');
    expect(mockGetDirectoryGroups).toHaveBeenCalledWith('user@example.com');
    expect(mockUpdate).toHaveBeenCalled();
  });

  it('writes all fields and directoryLastSyncedAt when both API calls succeed', async () => {
    mockEnv.mockReturnValue('true');

    mockFindUnique.mockResolvedValue({ directoryLastSyncedAt: null });
    mockGetDirectoryUser.mockResolvedValue({
      department: 'Engineering',
      title: 'Software Engineer',
      orgUnitPath: '/Staff/Engineering',
    });
    mockGetDirectoryGroups.mockResolvedValue(['group-a@example.com', 'group-b@example.com']);

    const { syncGoogleDirectory } = await import('./sync-google-directory');
    await syncGoogleDirectory(42, 'user@example.com');

    expect(mockUpdate).toHaveBeenCalledTimes(1);
    const updateCall = mockUpdate.mock.calls[0][0];
    expect(updateCall.where).toEqual({ id: 42 });
    expect(updateCall.data).toMatchObject({
      department: 'Engineering',
      title: 'Software Engineer',
      orgUnitPath: '/Staff/Engineering',
      googleGroups: ['group-a@example.com', 'group-b@example.com'],
    });
    expect(updateCall.data.directoryLastSyncedAt).toBeInstanceOf(Date);
  });

  it('omits googleGroups when getDirectoryGroups returns null', async () => {
    mockEnv.mockReturnValue('true');

    mockFindUnique.mockResolvedValue({ directoryLastSyncedAt: null });
    mockGetDirectoryUser.mockResolvedValue({
      department: 'Engineering',
      title: 'Software Engineer',
      orgUnitPath: '/Staff/Engineering',
    });
    mockGetDirectoryGroups.mockResolvedValue(null);

    const { syncGoogleDirectory } = await import('./sync-google-directory');
    await syncGoogleDirectory(42, 'user@example.com');

    expect(mockUpdate).toHaveBeenCalledTimes(1);
    const updateData = mockUpdate.mock.calls[0][0].data;
    expect(updateData).toMatchObject({
      department: 'Engineering',
      title: 'Software Engineer',
      orgUnitPath: '/Staff/Engineering',
    });
    expect(updateData).not.toHaveProperty('googleGroups');
    expect(updateData.directoryLastSyncedAt).toBeInstanceOf(Date);
  });

  it('omits user fields when getDirectoryUser returns null', async () => {
    mockEnv.mockReturnValue('true');

    mockFindUnique.mockResolvedValue({ directoryLastSyncedAt: null });
    mockGetDirectoryUser.mockResolvedValue(null);
    mockGetDirectoryGroups.mockResolvedValue(['group@example.com']);

    const { syncGoogleDirectory } = await import('./sync-google-directory');
    await syncGoogleDirectory(42, 'user@example.com');

    expect(mockUpdate).toHaveBeenCalledTimes(1);
    const updateData = mockUpdate.mock.calls[0][0].data;
    expect(updateData).toMatchObject({
      googleGroups: ['group@example.com'],
    });
    expect(updateData).not.toHaveProperty('department');
    expect(updateData).not.toHaveProperty('title');
    expect(updateData).not.toHaveProperty('orgUnitPath');
    expect(updateData.directoryLastSyncedAt).toBeInstanceOf(Date);
  });

  it('logs warning and skips update when both API calls return null', async () => {
    mockEnv.mockReturnValue('true');

    mockFindUnique.mockResolvedValue({ directoryLastSyncedAt: null });
    mockGetDirectoryUser.mockResolvedValue(null);
    mockGetDirectoryGroups.mockResolvedValue(null);

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    const { syncGoogleDirectory } = await import('./sync-google-directory');
    await syncGoogleDirectory(42, 'user@example.com');

    expect(mockUpdate).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('[directory-sync]'));

    warnSpy.mockRestore();
  });

  it('catches error, logs warning, and does not throw when Prisma query throws', async () => {
    mockEnv.mockReturnValue('true');

    mockFindUnique.mockRejectedValue(new Error('DB connection lost'));

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    const { syncGoogleDirectory } = await import('./sync-google-directory');
    await expect(syncGoogleDirectory(42, 'user@example.com')).resolves.toBeUndefined();

    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('[directory-sync]'));
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('DB connection lost'));

    warnSpy.mockRestore();
  });
});
