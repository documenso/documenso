import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AppErrorCode } from '../../errors/app-error';

const prismaMock = vi.hoisted(() => ({
  fontAsset: {
    create: vi.fn(),
    findFirst: vi.fn(),
  },
  recipient: {
    findFirst: vi.fn(),
  },
}));

const getFileServerSideMock = vi.hoisted(() => vi.fn());
const putFileServerSideMock = vi.hoisted(() => vi.fn());
const parseFontFileMock = vi.hoisted(() => vi.fn());

vi.mock('@documenso/prisma', () => ({
  prisma: prismaMock,
}));

vi.mock('@prisma/client', () => ({
  DocumentDataType: {
    BYTES_64: 'BYTES_64',
  },
  DocumentVisibility: {
    ADMIN: 'ADMIN',
    MANAGER_AND_ABOVE: 'MANAGER_AND_ABOVE',
    EVERYONE: 'EVERYONE',
  },
  OrganisationGroupType: {
    CUSTOM: 'CUSTOM',
    INTERNAL_ORGANISATION: 'INTERNAL_ORGANISATION',
    INTERNAL_TEAM: 'INTERNAL_TEAM',
  },
  OrganisationMemberRole: {
    ADMIN: 'ADMIN',
    MANAGER: 'MANAGER',
    MEMBER: 'MEMBER',
  },
  TeamMemberRole: {
    ADMIN: 'ADMIN',
    MANAGER: 'MANAGER',
    MEMBER: 'MEMBER',
  },
}));

vi.mock('../../universal/upload/get-file.server', () => ({
  getFileServerSide: getFileServerSideMock,
}));

vi.mock('../../universal/upload/put-file.server', () => ({
  putFileServerSide: putFileServerSideMock,
}));

vi.mock('./font-file', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./font-file')>();

  return {
    ...actual,
    parseFontFile: parseFontFileMock,
  };
});

import { createFontAsset, getFontAssetFileForRecipientToken, getFontAssetFileForUser } from './font-assets';
import { MAX_FONT_FILE_SIZE } from './font-file';

describe('font assets', () => {
  beforeEach(() => {
    vi.resetAllMocks();

    parseFontFileMock.mockReturnValue({
      family: 'Parsed Font',
      name: 'Parsed Font',
    });

    putFileServerSideMock.mockResolvedValue({
      type: 'BYTES_64',
      data: 'stored-font-data',
    });

    prismaMock.fontAsset.create.mockImplementation(async ({ data }) => ({
      id: 'font_asset_1',
      ...data,
    }));
  });

  it('rejects uploads when the decoded bytes exceed the font size limit', async () => {
    const bytes = new Uint8Array(MAX_FONT_FILE_SIZE + 1);

    await expect(
      createFontAsset({
        userId: 1,
        target: {
          type: 'personal',
        },
        file: {
          name: 'oversized.ttf',
          type: 'font/ttf',
          size: 1,
          arrayBuffer: async () => bytes.buffer,
        },
      }),
    ).rejects.toMatchObject({
      code: AppErrorCode.LIMIT_EXCEEDED,
    });

    expect(parseFontFileMock).not.toHaveBeenCalled();
    expect(prismaMock.fontAsset.create).not.toHaveBeenCalled();
  });

  it('persists the decoded byte length instead of the caller supplied size', async () => {
    const bytes = new Uint8Array([1, 2, 3, 4]);

    await createFontAsset({
      userId: 1,
      target: {
        type: 'personal',
      },
      file: {
        name: 'small.ttf',
        type: 'font/ttf',
        size: 1,
        arrayBuffer: async () => bytes.buffer,
      },
    });

    expect(prismaMock.fontAsset.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          fileSize: bytes.byteLength,
        }),
      }),
    );
  });

  it('infers and validates the MIME type when the uploaded file has no client MIME type', async () => {
    const bytes = new Uint8Array([1, 2, 3, 4]);

    await createFontAsset({
      userId: 1,
      target: {
        type: 'personal',
      },
      file: {
        name: 'small.otf',
        type: '',
        size: bytes.byteLength,
        arrayBuffer: async () => bytes.buffer,
      },
    });

    expect(putFileServerSideMock).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'font/otf',
      }),
    );
    expect(prismaMock.fontAsset.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          mimeType: 'font/otf',
        }),
      }),
    );
  });

  it('requires user-visible ownership before reading font bytes for a user', async () => {
    const fontAsset = {
      id: 'font_asset_1',
      dataType: 'BYTES_64',
      data: 'stored-font-data',
      mimeType: 'font/ttf',
    };

    prismaMock.fontAsset.findFirst.mockResolvedValue(fontAsset);
    getFileServerSideMock.mockResolvedValue(new Uint8Array([1, 2, 3]));

    const result = await getFontAssetFileForUser({
      userId: 1,
      fontId: 'font_asset_1',
    });

    expect(prismaMock.fontAsset.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: 'font_asset_1',
          OR: expect.arrayContaining([
            {
              userId: 1,
            },
          ]),
        }),
      }),
    );
    expect(result).toEqual({
      fontAsset,
      bytes: new Uint8Array([1, 2, 3]),
    });
  });

  it('rejects font byte reads for users outside the visible library', async () => {
    prismaMock.fontAsset.findFirst.mockResolvedValue(null);

    await expect(
      getFontAssetFileForUser({
        userId: 2,
        fontId: 'font_asset_1',
      }),
    ).rejects.toMatchObject({
      code: AppErrorCode.NOT_FOUND,
    });

    expect(getFileServerSideMock).not.toHaveBeenCalled();
  });

  it('allows recipient-token font reads only through the recipient envelope context', async () => {
    const fontAsset = {
      id: 'font_asset_1',
      dataType: 'BYTES_64',
      data: 'stored-font-data',
      mimeType: 'font/ttf',
    };

    prismaMock.recipient.findFirst.mockResolvedValue({
      envelope: {
        userId: 1,
        teamId: 2,
        team: {
          organisationId: 'org_3',
        },
      },
    });
    prismaMock.fontAsset.findFirst.mockResolvedValue(fontAsset);
    getFileServerSideMock.mockResolvedValue(new Uint8Array([1, 2, 3]));

    await getFontAssetFileForRecipientToken({
      fontId: 'font_asset_1',
      token: 'recipient_token',
    });

    expect(prismaMock.fontAsset.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: 'font_asset_1',
          OR: [{ userId: 1 }, { teamId: 2 }, { organisationId: 'org_3' }],
        }),
      }),
    );
  });
});
