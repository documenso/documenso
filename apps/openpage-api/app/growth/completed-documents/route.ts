import cors from '@/lib/cors';
import { getCompletedDocumentsMonthly } from '@/lib/growth/get-monthly-completed-document';

export async function GET(request: Request) {
  const completedDocuments = await getCompletedDocumentsMonthly();

  return cors(
    request,
    new Response(JSON.stringify(completedDocuments), {
      status: 200,
      headers: {
        'content-type': 'application/json',
      },
    }),
  );
}

export function OPTIONS(request: Request) {
  return cors(
    request,
    new Response(null, {
      status: 204,
    }),
  );
}
