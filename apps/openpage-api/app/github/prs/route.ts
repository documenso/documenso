import cors from '@/lib/cors';

export async function GET(request: Request) {
  const res = await fetch(
    'https://api.github.com/search/issues?q=repo:documenso/documenso/+is:pr+merged:>=2010-01-01&page=0&per_page=1',
  );
  const { total_count } = await res.json();

  return cors(
    request,
    new Response(JSON.stringify({ data: total_count }), {
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
