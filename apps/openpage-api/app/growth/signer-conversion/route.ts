import cors from '@/lib/cors';
import { getSignerConversionMonthly } from '@/lib/growth/get-signer-conversion';

export async function GET(request: Request) {
  const signers = await getSignerConversionMonthly();

  return cors(
    request,
    new Response(JSON.stringify(signers), {
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
