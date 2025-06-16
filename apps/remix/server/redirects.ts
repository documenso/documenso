import type { Context } from 'hono';

import { getSession } from '@documenso/auth/server/lib/utils/get-session';
import { buildTeamWhereQuery } from '@documenso/lib/utils/teams';
import { prisma } from '@documenso/prisma';

function extractIdFromPath(path: string, prefix: string): string | null {
  const regex = new RegExp(`^${prefix}/([^/]+)`);
  const match = path.match(regex);
  return match ? match[1] : null;
}

export const handleRedirects = async (c: Context): Promise<string | null> => {
  const { req } = c;
  const path = req.path;

  // Direct rewrites
  if (
    path === '/documents' ||
    path === '/documents/folders' ||
    path === '/templates' ||
    path === '/templates/folders'
  ) {
    return '/';
  }

  // Document folder routes.
  if (path.startsWith('/documents/f/')) {
    const folderId = extractIdFromPath(path, '/documents/f');

    if (!folderId) {
      return '/';
    }

    const teamUrl = await hasAccessToFolder(c, folderId);

    if (folderId && teamUrl) {
      return `/t/${teamUrl}/documents/f/${folderId}`;
    }
  }

  // Document routes.
  if (path.startsWith('/documents/')) {
    const rawDocumentId = extractIdFromPath(path, '/documents');

    const documentId = Number(rawDocumentId);

    if (!documentId || isNaN(documentId)) {
      return '/';
    }

    const teamUrl = await hasAccessToDocument(c, documentId);

    if (!teamUrl) {
      return '/';
    }

    const queryString = req.url.split('?')[1];
    const redirectPath = `/t/${teamUrl}${path}${queryString ? `?${queryString}` : ''}`;

    return redirectPath;
  }

  // Template folder routes.
  if (path.startsWith('/templates/f/')) {
    const folderId = extractIdFromPath(path, '/templates/f');

    if (!folderId) {
      return '/';
    }

    const teamUrl = await hasAccessToFolder(c, folderId);

    if (folderId && teamUrl) {
      return `/t/${teamUrl}/templates/f/${folderId}`;
    }
  }

  if (path.startsWith('/templates/')) {
    const rawTemplateId = extractIdFromPath(path, '/templates');
    const templateId = Number(rawTemplateId);

    if (!templateId || isNaN(templateId)) {
      return '/';
    }

    const teamUrl = await hasAccessToTemplate(c, templateId);

    if (!teamUrl) {
      return '/';
    }

    const queryString = req.url.split('?')[1];
    const redirectPath = `/t/${teamUrl}${path}${queryString ? `?${queryString}` : ''}`;

    return redirectPath;
  }

  return null;
};

async function hasAccessToDocument(c: Context, documentId: number): Promise<string | null> {
  const session = await getSession(c);

  const userId = session.user.id;

  const document = await prisma.document.findUnique({
    where: {
      id: documentId,
      team: buildTeamWhereQuery({
        userId,
        teamId: undefined,
      }),
    },
    select: {
      team: {
        select: {
          url: true,
        },
      },
    },
  });

  return document ? document.team.url : null;
}

async function hasAccessToFolder(c: Context, folderId: string): Promise<string | null> {
  const session = await getSession(c);

  const userId = session.user.id;

  const folder = await prisma.folder.findUnique({
    where: {
      id: folderId,
      team: buildTeamWhereQuery({
        userId,
        teamId: undefined,
      }),
    },
    select: {
      team: {
        select: {
          url: true,
        },
      },
    },
  });

  return folder ? folder.team.url : null;
}

async function hasAccessToTemplate(c: Context, templateId: number): Promise<string | null> {
  const session = await getSession(c);

  const userId = session.user.id;

  const template = await prisma.template.findUnique({
    where: {
      id: templateId,
      team: buildTeamWhereQuery({
        userId,
        teamId: undefined,
      }),
    },
    select: {
      team: {
        select: {
          url: true,
        },
      },
    },
  });

  return template ? template.team.url : null;
}
