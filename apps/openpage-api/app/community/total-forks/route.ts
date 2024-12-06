import cors from '@/lib/cors';
import { transformData } from '@/lib/transform-data';

export async function GET(request: Request) {
  const res = await fetch('https://stargrazer-live.onrender.com/api/stats');
  const data = await res.json();
  const transformedData = transformData({ data, metric: 'forks' });

  return cors(
    request,
    new Response(JSON.stringify(transformedData), {
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
