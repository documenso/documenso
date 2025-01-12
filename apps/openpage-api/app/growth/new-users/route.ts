import cors from '@/lib/cors';
import { getUserMonthlyGrowth } from '@/lib/growth/get-user-monthly-growth';

export async function GET(request: Request) {
  const monthlyUsers = await getUserMonthlyGrowth();

  return cors(
    request,
    new Response(JSON.stringify(monthlyUsers), {
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
