import { getSession } from '@documenso/auth/server/lib/utils/get-session';
import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { getDocumentById } from '@documenso/lib/server-only/document/get-document-by-id';
import { getAuditLogsPdf } from '@documenso/lib/server-only/htmltopdf/get-audit-logs-pdf';
import { getTeamByUrl } from '@documenso/lib/server-only/team/get-team';

import type { Route } from './+types/t.$teamUrl.download.audit-logs.$documentId';

export async function loader({ request, params }: Route.LoaderArgs) {
  const documentId = Number(params.documentId);
  const teamUrl = params.teamUrl;

  if (!documentId || !teamUrl) {
    return Response.json({ error: 'Invalid document ID or team URL' }, { status: 400 });
  }

  try {
    const { user } = await getSession(request);

    const team = await getTeamByUrl({ userId: user.id, teamUrl });

    if (!team) {
      return Response.json({ error: 'Team not found or access denied' }, { status: 404 });
    }

    const document = await getDocumentById({
      documentId,
      userId: user.id,
      teamId: team.id,
    }).catch(() => null);

    if (!document || (team.id && document.teamId !== team.id)) {
      return Response.json({ error: 'Document not found or access denied' }, { status: 404 });
    }

    const pdfBuffer = await getAuditLogsPdf({
      documentId: document.id,
      language: document.documentMeta?.language,
    });

    const filename = `${document.title.replace(/\.pdf$/, '')}_audit_logs.pdf`;

    return new Response(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': pdfBuffer.length.toString(),
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        Expires: '0',
      },
    });
  } catch (error) {
    if (error instanceof AppError) {
      const statusCode = error.code === AppErrorCode.UNAUTHORIZED ? 401 : 400;

      return Response.json({ error: error.message }, { status: statusCode });
    }

    return Response.json({ error: 'Failed to generate audit logs PDF' }, { status: 500 });
  }
}
