import cors from '@/lib/cors';
import { transformRepoStats } from '@/lib/transform-repo-stats';

export async function GET(request: Request) {
  const res = await fetch('https://stargrazer-live.onrender.com/api/stats/stripe');
  const EARLY_ADOPTERS_DATA = await res.json();

  const transformedData = transformRepoStats(EARLY_ADOPTERS_DATA, 'earlyAdopters');

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
