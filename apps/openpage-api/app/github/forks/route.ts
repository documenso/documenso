import cors from '@/lib/cors';

export async function GET(request: Request) {
  const res = await fetch('https://api.github.com/repos/documenso/documenso');
  const { forks_count } = await res.json();

  return cors(
    request,
    new Response(JSON.stringify({ data: forks_count }), {
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
